import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { getCognitoLogoutUrl } from "@/app/auth/cognito";
import { clearAuthToken, getAuthSession, setAuthSession, setAuthToken, type AuthProvider, type AuthSession } from "@/app/auth/auth-store";
import { extractRoles, parseJwtPayload } from "@/app/auth/jwt";
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

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<AuthSession | null>(() => getAuthSession());
  const [authMe, setAuthMe] = useState<AuthMeResponse | null>(null);

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
          clearAuthToken();
          setSession(null);
        }
      }
    };

    void loadAuthMe();

    return () => {
      cancelled = true;
    };
  }, [session?.apiToken]);

  const value = useMemo<AuthContextValue>(
    () => {
      const token = session?.apiToken ?? null;
      const roleToken = session?.roleToken || token;
      const payload = roleToken ? parseJwtPayload(roleToken) : null;
      const tokenRoles = roleToken ? extractRoles(roleToken) : [];
      const displayName =
        (typeof payload?.name === "string" && payload.name) ||
        (typeof payload?.["cognito:username"] === "string" && payload["cognito:username"]) ||
        null;
      const email = authMe?.email ?? ((typeof payload?.email === "string" && payload.email) || null);

      return {
        token,
        provider: session?.provider ?? null,
        roles: authMe?.roles ?? tokenRoles,
        isPreviewMode: false,
        displayName,
        email,
        isAuthenticated: Boolean(session),
        login: (nextToken: string) => {
          setAuthToken(nextToken);
          setSession(getAuthSession());
        },
        loginWithSession: (nextSession: AuthSession) => {
          setAuthSession(nextSession);
          setSession(nextSession);
          setAuthMe(null);
        },
        logout: () => {
          const previousProvider = session?.provider ?? null;
          clearAuthToken();
          setSession(null);
          setAuthMe(null);

          if (previousProvider === "cognito") {
            const logoutUrl = getCognitoLogoutUrl();
            if (logoutUrl) {
              window.location.assign(logoutUrl);
            }
          }
        }
      };
    },
    [authMe, session]
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
