const LEGACY_TOKEN_KEY = "msc_admin_token";
const SESSION_KEY = "msc_admin_auth_session";
const LOGOUT_REASON_KEY = "msc_admin_logout_reason";

export type AuthProvider = "manual" | "cognito";
export type AuthLogoutReason = "session_expired" | "idle_timeout" | "session_max_age" | "mfa_required";

export type AuthSession = {
  apiToken?: string;
  roleToken?: string;
  idToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  createdAt?: number;
  lastActivityAt?: number;
  previewRoles?: string[];
  provider: AuthProvider;
};

type SessionRefresher = () => Promise<AuthSession | null>;

let inMemorySession: AuthSession | null = null;
let sessionRefresher: SessionRefresher | null = null;

function parseSession(raw: string | null): AuthSession | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    const apiToken = typeof parsed?.apiToken === "string" ? parsed.apiToken.trim() : "";
    if (!parsed || !apiToken) {
      return null;
    }
    return {
      apiToken: apiToken || undefined,
      roleToken: typeof parsed.roleToken === "string" ? parsed.roleToken : undefined,
      idToken: typeof parsed.idToken === "string" ? parsed.idToken : undefined,
      refreshToken: typeof parsed.refreshToken === "string" ? parsed.refreshToken : undefined,
      expiresAt: typeof parsed.expiresAt === "number" ? parsed.expiresAt : undefined,
      createdAt: typeof parsed.createdAt === "number" ? parsed.createdAt : undefined,
      lastActivityAt: typeof parsed.lastActivityAt === "number" ? parsed.lastActivityAt : undefined,
      provider: parsed.provider === "cognito" ? "cognito" : "manual"
    };
  } catch {
    return null;
  }
}

function withSessionDefaults(session: AuthSession): AuthSession {
  const now = Date.now();
  return {
    ...session,
    createdAt: typeof session.createdAt === "number" ? session.createdAt : now,
    lastActivityAt: typeof session.lastActivityAt === "number" ? session.lastActivityAt : now
  };
}

export function getAuthSession(): AuthSession | null {
  if (inMemorySession) {
    return inMemorySession;
  }

  const storedSession = parseSession(localStorage.getItem(SESSION_KEY));
  if (storedSession) {
    if (typeof storedSession.expiresAt === "number" && storedSession.expiresAt <= Date.now()) {
      localStorage.removeItem(SESSION_KEY);
    } else {
      const normalized = withSessionDefaults(storedSession);
      inMemorySession = normalized;
      localStorage.setItem(SESSION_KEY, JSON.stringify(normalized));
      return normalized;
    }
  }

  const legacyToken = localStorage.getItem(LEGACY_TOKEN_KEY);
  if (!legacyToken) {
    return null;
  }

  const migrated: AuthSession = {
    apiToken: legacyToken,
    roleToken: legacyToken,
    provider: "manual"
  };
  const withDefaults = withSessionDefaults(migrated);
  localStorage.setItem(SESSION_KEY, JSON.stringify(withDefaults));
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  inMemorySession = withDefaults;
  return withDefaults;
}

export function getAuthToken() {
  return getAuthSession()?.apiToken ?? null;
}

export function setAuthSession(session: AuthSession) {
  const normalized = withSessionDefaults(session);
  inMemorySession = normalized;
  localStorage.setItem(SESSION_KEY, JSON.stringify(normalized));
  localStorage.removeItem(LEGACY_TOKEN_KEY);
}

export function setAuthToken(token: string) {
  setAuthSession({
    apiToken: token,
    roleToken: token,
    provider: "manual"
  });
}

export function clearAuthToken() {
  inMemorySession = null;
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
}

export function setAuthLogoutReason(reason: AuthLogoutReason) {
  localStorage.setItem(LOGOUT_REASON_KEY, reason);
}

export function consumeAuthLogoutReason(): AuthLogoutReason | null {
  const value = localStorage.getItem(LOGOUT_REASON_KEY);
  localStorage.removeItem(LOGOUT_REASON_KEY);
  if (value === "session_expired" || value === "idle_timeout" || value === "session_max_age" || value === "mfa_required") {
    return value;
  }
  return null;
}

export function registerAuthSessionRefresher(refresher: SessionRefresher) {
  sessionRefresher = refresher;
  return () => {
    if (sessionRefresher === refresher) {
      sessionRefresher = null;
    }
  };
}

export async function refreshAuthSession() {
  if (!sessionRefresher) {
    return null;
  }
  return sessionRefresher();
}
