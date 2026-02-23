const LEGACY_TOKEN_KEY = "msc_admin_token";
const SESSION_KEY = "msc_admin_auth_session";

export type AuthProvider = "manual" | "cognito";

export type AuthSession = {
  apiToken?: string;
  roleToken?: string;
  idToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  previewRoles?: string[];
  provider: AuthProvider;
};

let inMemorySession: AuthSession | null = null;

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
      provider: parsed.provider === "cognito" ? "cognito" : "manual"
    };
  } catch {
    return null;
  }
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
      inMemorySession = storedSession;
      return storedSession;
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
  localStorage.setItem(SESSION_KEY, JSON.stringify(migrated));
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  inMemorySession = migrated;
  return migrated;
}

export function getAuthToken() {
  return getAuthSession()?.apiToken ?? null;
}

export function setAuthSession(session: AuthSession) {
  inMemorySession = session;
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
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
