import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import { getCognitoLogoutUrl, refreshCognitoSession } from "@/app/auth/cognito";
import {
  clearAuthToken,
  getAuthSession,
  registerAuthSessionRefresher,
  setAuthLogoutReason,
  setAuthSession,
  setAuthToken,
  type AuthLogoutReason,
  type AuthProvider,
  type AuthSession
} from "@/app/auth/auth-store";
import { getEffectiveRoles } from "@/app/auth/iam";
import { extractRoles, hasMfaAuthentication, parseJwtPayload } from "@/app/auth/jwt";
import { ApiError, requestJson } from "@/services/api/http-client";

type AuthContextValue = {
  token: string | null;
  provider: AuthProvider | null;
  roles: string[];
  isPreviewMode: boolean;
  displayName: string | null;
  email: string | null;
  isAuthenticated: boolean;
  login: (token: string) => void;
  loginWithSession: (session: AuthSession) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type AuthMeResponse = {
  ok: boolean;
  sub: string | null;
  email: string | null;
  roles: string[];
};

const AUTO_REFRESH_SKEW_MS = 60_000;
const ACTIVITY_WRITE_THROTTLE_MS = 30_000;
const SESSION_MONITOR_INTERVAL_MS = 15_000;
const DEFAULT_IDLE_TIMEOUT_MINUTES = 45;
const DEFAULT_MAX_SESSION_HOURS = 12;

function readPositiveNumberEnv(name: string, fallback: number): number {
  const raw = String(import.meta.env[name] ?? "").trim();
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

const IDLE_TIMEOUT_MS = readPositiveNumberEnv("VITE_AUTH_IDLE_TIMEOUT_MINUTES", DEFAULT_IDLE_TIMEOUT_MINUTES) * 60 * 1000;
const MAX_SESSION_AGE_MS = readPositiveNumberEnv("VITE_AUTH_MAX_SESSION_HOURS", DEFAULT_MAX_SESSION_HOURS) * 60 * 60 * 1000;
const REQUIRE_ADMIN_MFA =
  !import.meta.env.DEV && String(import.meta.env.VITE_AUTH_REQUIRE_ADMIN_MFA || "false").toLowerCase() === "true";

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<AuthSession | null>(() => getAuthSession());
  const [authMe, setAuthMe] = useState<AuthMeResponse | null>(null);

  const refreshPromiseRef = useRef<Promise<AuthSession | null> | null>(null);
  const lastActivityPersistRef = useRef(0);

  const clearSession = useCallback(
    (options?: { reason?: AuthLogoutReason; federatedLogout?: boolean }) => {
      const reason = options?.reason;
      if (reason) {
        setAuthLogoutReason(reason);
      }

      const previousProvider = session?.provider ?? getAuthSession()?.provider ?? null;
      clearAuthToken();
      setSession(null);
      setAuthMe(null);

      if (options?.federatedLogout && previousProvider === "cognito") {
        const logoutUrl = getCognitoLogoutUrl();
        if (logoutUrl) {
          window.location.assign(logoutUrl);
        }
      }
    },
    [session?.provider]
  );

  const refreshSession = useCallback(async (): Promise<AuthSession | null> => {
    const current = getAuthSession();
    if (!current?.apiToken) {
      return null;
    }
    if (current.provider !== "cognito") {
      return current;
    }
    if (!current.refreshToken) {
      clearSession({ reason: "session_expired" });
      return null;
    }

    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    const refreshPromise = refreshCognitoSession(current)
      .then((nextSession) => {
        setAuthSession(nextSession);
        setSession(nextSession);
        return nextSession;
      })
      .catch(() => {
        clearSession({ reason: "session_expired" });
        return null;
      })
      .finally(() => {
        refreshPromiseRef.current = null;
      });

    refreshPromiseRef.current = refreshPromise;
    return refreshPromise;
  }, [clearSession]);

  const touchActivity = useCallback(() => {
    if (!session?.apiToken) {
      return;
    }

    const now = Date.now();
    if (now - lastActivityPersistRef.current < ACTIVITY_WRITE_THROTTLE_MS) {
      return;
    }
    lastActivityPersistRef.current = now;

    setSession((prev) => {
      if (!prev) {
        return prev;
      }
      const nextSession: AuthSession = {
        ...prev,
        createdAt: typeof prev.createdAt === "number" ? prev.createdAt : now,
        lastActivityAt: now
      };
      setAuthSession(nextSession);
      return nextSession;
    });
  }, [session?.apiToken]);

  useEffect(() => {
    return registerAuthSessionRefresher(refreshSession);
  }, [refreshSession]);

  useEffect(() => {
    if (!session?.apiToken) {
      setAuthMe(null);
      return;
    }

    let cancelled = false;

    const loadAuthMe = async () => {
      try {
        const response = await requestJson<AuthMeResponse>("/admin/auth/me");
        if (cancelled) {
          return;
        }
        setAuthMe(response);
      } catch (error) {
        if (cancelled) {
          return;
        }
        setAuthMe(null);
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          clearSession({ reason: "session_expired" });
        }
      }
    };

    void loadAuthMe();

    return () => {
      cancelled = true;
    };
  }, [clearSession, session?.apiToken]);

  const tokenRoles = useMemo(() => {
    const roleToken = session?.roleToken || session?.apiToken;
    if (!roleToken) {
      return [] as string[];
    }
    return extractRoles(roleToken);
  }, [session?.apiToken, session?.roleToken]);

  const resolvedRoles = authMe?.roles ?? tokenRoles;
  const effectiveRoles = useMemo(() => getEffectiveRoles(resolvedRoles), [resolvedRoles]);

  useEffect(() => {
    if (!session?.apiToken || session.provider !== "cognito" || !session.expiresAt) {
      return;
    }

    const millisUntilRefresh = session.expiresAt - Date.now() - AUTO_REFRESH_SKEW_MS;
    if (millisUntilRefresh <= 0) {
      void refreshSession();
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void refreshSession();
    }, millisUntilRefresh);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [refreshSession, session?.apiToken, session?.expiresAt, session?.provider]);

  useEffect(() => {
    if (!session?.apiToken) {
      return;
    }

    const onActivity = () => {
      touchActivity();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      touchActivity();

      const current = getAuthSession();
      if (!current || current.provider !== "cognito" || typeof current.expiresAt !== "number") {
        return;
      }

      if (current.expiresAt - Date.now() <= AUTO_REFRESH_SKEW_MS) {
        void refreshSession();
      }
    };

    window.addEventListener("pointerdown", onActivity);
    window.addEventListener("keydown", onActivity);
    window.addEventListener("touchstart", onActivity);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("touchstart", onActivity);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refreshSession, session?.apiToken, touchActivity]);

  useEffect(() => {
    if (import.meta.env.DEV || !session?.apiToken) {
      return;
    }

    const intervalId = window.setInterval(() => {
      const current = getAuthSession();
      if (!current?.apiToken) {
        return;
      }

      const now = Date.now();
      const createdAt = typeof current.createdAt === "number" ? current.createdAt : now;
      const lastActivityAt = typeof current.lastActivityAt === "number" ? current.lastActivityAt : createdAt;

      if (now - lastActivityAt > IDLE_TIMEOUT_MS) {
        clearSession({ reason: "idle_timeout" });
        return;
      }

      if (now - createdAt > MAX_SESSION_AGE_MS) {
        clearSession({ reason: "session_max_age" });
      }
    }, SESSION_MONITOR_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [clearSession, session?.apiToken]);

  useEffect(() => {
    if (!REQUIRE_ADMIN_MFA || !session?.apiToken || session.provider !== "cognito") {
      return;
    }

    if (!effectiveRoles.includes("admin")) {
      return;
    }

    const mfaToken = session.idToken || session.roleToken || session.apiToken;
    if (!mfaToken) {
      return;
    }

    if (hasMfaAuthentication(mfaToken)) {
      return;
    }

    clearSession({ reason: "mfa_required" });
  }, [clearSession, effectiveRoles, session?.apiToken, session?.idToken, session?.provider, session?.roleToken]);

  const value = useMemo<AuthContextValue>(
    () => {
      const token = session?.apiToken ?? null;
      const roleToken = session?.roleToken || token;
      const payload = roleToken ? parseJwtPayload(roleToken) : null;
      const displayName =
        (typeof payload?.name === "string" && payload.name) ||
        (typeof payload?.["cognito:username"] === "string" && payload["cognito:username"]) ||
        null;
      const email = authMe?.email ?? ((typeof payload?.email === "string" && payload.email) || null);

      return {
        token,
        provider: session?.provider ?? null,
        roles: resolvedRoles,
        isPreviewMode: false,
        displayName,
        email,
        isAuthenticated: Boolean(session),
        login: (nextToken: string) => {
          setAuthToken(nextToken);
          setSession(getAuthSession());
          setAuthMe(null);
        },
        loginWithSession: (nextSession: AuthSession) => {
          setAuthSession(nextSession);
          setSession(getAuthSession());
          setAuthMe(null);
        },
        logout: () => {
          clearSession({ federatedLogout: true });
        }
      };
    },
    [authMe?.email, clearSession, resolvedRoles, session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
