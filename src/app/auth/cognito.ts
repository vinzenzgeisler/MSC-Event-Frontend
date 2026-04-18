import type { AuthSession } from "@/app/auth/auth-store";

const COGNITO_STATE_KEY = "msc_cognito_oauth_state";
const COGNITO_VERIFIER_KEY = "msc_cognito_pkce_verifier";
const COGNITO_RETURN_TO_KEY = "msc_cognito_return_to";
const COGNITO_BRIDGE_REFRESH_COOKIE = "msc_cognito_bridge_refresh_token";
const COGNITO_BRIDGE_CREATED_AT_COOKIE = "msc_cognito_bridge_created_at";
const COGNITO_BRIDGE_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;
const REQUIRED_SCOPES = ["openid", "email", "profile"] as const;

type RuntimeConfig = Partial<Record<string, string | boolean | null | undefined>>;

declare global {
  interface Window {
    __MSC_RUNTIME_CONFIG__?: RuntimeConfig;
  }
}

function base64UrlEncode(bytes: Uint8Array): string {
  const raw = String.fromCharCode(...bytes);
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function utf8ToBytes(input: string): Uint8Array {
  return new TextEncoder().encode(input);
}

function randomString(length = 64): string {
  const random = new Uint8Array(length);
  crypto.getRandomValues(random);
  return base64UrlEncode(random).slice(0, length);
}

async function createCodeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", utf8ToBytes(verifier));
  return base64UrlEncode(new Uint8Array(digest));
}

export function isCognitoEnabled() {
  const { domain, clientId, redirectUri, logoutUri } = getCognitoConfig();
  return Boolean(domain && clientId && redirectUri && logoutUri);
}

function normalizeScopes(raw: string): string {
  const seen = new Set<string>();
  raw
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((item) => seen.add(item));

  REQUIRED_SCOPES.forEach((scope) => seen.add(scope));
  return Array.from(seen).join(" ");
}

function resolveAuthUriFromRuntime(rawEnvValue: string, fallbackPath: string): string {
  const fallback = `${window.location.origin}${fallbackPath}`;
  const trimmed = rawEnvValue.trim();
  if (!trimmed) {
    return fallback;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.origin !== window.location.origin) {
      return fallback;
    }
    return parsed.toString();
  } catch {
    return fallback;
  }
}

function readConfigValue(envKey: string, runtimeKey: string, fallback = ""): string {
  const runtimeConfig = window.__MSC_RUNTIME_CONFIG__;
  const runtimeValue = runtimeConfig?.[runtimeKey] ?? runtimeConfig?.[envKey];
  if (runtimeValue !== undefined && runtimeValue !== null) {
    return String(runtimeValue).trim();
  }

  const envValue = (import.meta.env as Record<string, unknown>)[envKey];
  if (envValue !== undefined && envValue !== null) {
    return String(envValue).trim();
  }

  return fallback;
}

function readBooleanConfig(envKey: string, runtimeKey: string, fallback = false): boolean {
  const raw = readConfigValue(envKey, runtimeKey, fallback ? "true" : "false").toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes" || raw === "on";
}

function isCognitoStorageBridgeEnabled(): boolean {
  return readBooleanConfig("VITE_COGNITO_STORAGE_BRIDGE", "cognitoStorageBridgeEnabled", false);
}

function buildCookieAttributes(maxAgeSeconds: number): string {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  return `Max-Age=${maxAgeSeconds}; Path=/; SameSite=Lax${secure}`;
}

function readCookie(name: string): string | null {
  const prefix = `${name}=`;
  const entry = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(prefix));
  if (!entry) {
    return null;
  }
  return decodeURIComponent(entry.slice(prefix.length));
}

function writeCookie(name: string, value: string, maxAgeSeconds: number) {
  document.cookie = `${name}=${encodeURIComponent(value)}; ${buildCookieAttributes(maxAgeSeconds)}`;
}

function clearCookie(name: string) {
  document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax${window.location.protocol === "https:" ? "; Secure" : ""}`;
}

export function persistCognitoSessionBridge(session: AuthSession) {
  if (!isCognitoStorageBridgeEnabled() || !session.refreshToken) {
    return;
  }

  const createdAt = typeof session.createdAt === "number" ? session.createdAt : Date.now();
  writeCookie(COGNITO_BRIDGE_REFRESH_COOKIE, session.refreshToken, COGNITO_BRIDGE_MAX_AGE_SECONDS);
  writeCookie(COGNITO_BRIDGE_CREATED_AT_COOKIE, String(createdAt), COGNITO_BRIDGE_MAX_AGE_SECONDS);
}

export function clearCognitoSessionBridge() {
  if (!isCognitoStorageBridgeEnabled()) {
    return;
  }

  clearCookie(COGNITO_BRIDGE_REFRESH_COOKIE);
  clearCookie(COGNITO_BRIDGE_CREATED_AT_COOKIE);
}

export function getCognitoConfig() {
  const domain = readConfigValue("VITE_COGNITO_DOMAIN", "cognitoDomain").replace(/\/$/, "");
  const clientId = readConfigValue("VITE_COGNITO_CLIENT_ID", "cognitoClientId");
  const redirectUri = resolveAuthUriFromRuntime(readConfigValue("VITE_COGNITO_REDIRECT_URI", "cognitoRedirectUri"), "/admin/login");
  const logoutUri = resolveAuthUriFromRuntime(readConfigValue("VITE_COGNITO_LOGOUT_URI", "cognitoLogoutUri"), "/admin/login");
  const scope = normalizeScopes(readConfigValue("VITE_COGNITO_SCOPES", "cognitoScopes") || "openid email profile");

  return {
    domain,
    clientId,
    redirectUri,
    logoutUri,
    scope
  };
}

export function isCognitoConfigured() {
  return isCognitoEnabled();
}

export function shouldShowManualTokenLogin() {
  const manualEnabled = readConfigValue("VITE_ADMIN_ENABLE_TOKEN_LOGIN", "adminEnableTokenLogin", "false").toLowerCase() === "true";
  if (!manualEnabled) {
    return false;
  }
  if (!isCognitoEnabled()) {
    return true;
  }
  // If Cognito is fully configured, hide manual fallback.
  return !isCognitoConfigured();
}

export function shouldShowRolePreviewLogin() {
  const enabled = readConfigValue("VITE_ADMIN_ENABLE_ROLE_PREVIEW", "adminEnableRolePreview", "false").toLowerCase() === "true";
  if (!enabled) {
    return false;
  }
  // If Cognito is fully configured, hide preview fallback.
  return !isCognitoConfigured();
}

export async function startCognitoLogin(returnTo?: string) {
  if (!isCognitoConfigured()) {
    throw new Error("Cognito ist nicht konfiguriert. Bitte VITE_COGNITO_* Variablen prüfen.");
  }

  const { domain, clientId, redirectUri, scope } = getCognitoConfig();
  try {
    new URL(redirectUri);
  } catch {
    throw new Error("VITE_COGNITO_REDIRECT_URI ist ungültig. Bitte exakt die erlaubte Callback-URL setzen.");
  }
  const state = randomString(36);
  const verifier = randomString(96);
  const challenge = await createCodeChallenge(verifier);

  localStorage.setItem(COGNITO_STATE_KEY, state);
  localStorage.setItem(COGNITO_VERIFIER_KEY, verifier);
  localStorage.setItem(COGNITO_RETURN_TO_KEY, returnTo || "/admin/dashboard");

  const url = new URL(`${domain}/oauth2/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", scope);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("code_challenge", challenge);

  window.location.assign(url.toString());
}

function clearPkceState() {
  localStorage.removeItem(COGNITO_STATE_KEY);
  localStorage.removeItem(COGNITO_VERIFIER_KEY);
}

export function consumeCognitoReturnTo(defaultPath = "/admin/dashboard") {
  const value = localStorage.getItem(COGNITO_RETURN_TO_KEY);
  localStorage.removeItem(COGNITO_RETURN_TO_KEY);
  return value || defaultPath;
}

type OAuthTokenResponse = {
  access_token?: string;
  id_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  error?: string;
  error_description?: string;
};

async function requestOAuthToken(body: URLSearchParams): Promise<OAuthTokenResponse> {
  const { domain } = getCognitoConfig();
  const response = await fetch(`${domain}/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: body.toString()
  });

  const payload = (await response.json()) as OAuthTokenResponse;
  if (!response.ok || payload.error) {
    throw new Error(payload.error_description || payload.error || "Cognito Token-Austausch fehlgeschlagen.");
  }

  return payload;
}

export async function handleCognitoCallbackIfPresent(currentHref = window.location.href): Promise<AuthSession | null> {
  if (!isCognitoConfigured()) {
    return null;
  }

  const url = new URL(currentHref);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  if (error) {
    clearPkceState();
    throw new Error(errorDescription || error);
  }

  if (!code) {
    return null;
  }

  const expectedState = localStorage.getItem(COGNITO_STATE_KEY);
  const verifier = localStorage.getItem(COGNITO_VERIFIER_KEY);

  if (!expectedState || !verifier || !state || expectedState !== state) {
    clearPkceState();
    throw new Error("Ungültiger Cognito Callback-Status. Bitte Login erneut starten.");
  }

  const { clientId, redirectUri } = getCognitoConfig();

  const body = new URLSearchParams();
  body.set("grant_type", "authorization_code");
  body.set("client_id", clientId);
  body.set("code", code);
  body.set("redirect_uri", redirectUri);
  body.set("code_verifier", verifier);

  let payload: OAuthTokenResponse;
  try {
    payload = await requestOAuthToken(body);
  } finally {
    clearPkceState();
  }

  const apiToken = payload.access_token || payload.id_token;
  if (!apiToken) {
    throw new Error("Cognito Antwort enthält kein verwendbares Access Token.");
  }

  const expiresInSeconds = typeof payload.expires_in === "number" ? payload.expires_in : 3600;

  const session: AuthSession = {
    apiToken,
    roleToken: payload.id_token || payload.access_token,
    idToken: payload.id_token,
    refreshToken: payload.refresh_token,
    expiresAt: Date.now() + expiresInSeconds * 1000,
    provider: "cognito"
  };
  persistCognitoSessionBridge(session);
  return session;
}

export async function refreshCognitoSession(session: AuthSession): Promise<AuthSession> {
  if (!isCognitoConfigured()) {
    throw new Error("Cognito ist nicht konfiguriert.");
  }
  if (session.provider !== "cognito") {
    throw new Error("Session ist kein Cognito-Login.");
  }
  if (!session.refreshToken) {
    throw new Error("Kein Refresh Token verfügbar.");
  }

  const { clientId } = getCognitoConfig();

  const body = new URLSearchParams();
  body.set("grant_type", "refresh_token");
  body.set("client_id", clientId);
  body.set("refresh_token", session.refreshToken);

  const payload = await requestOAuthToken(body);
  const nextApiToken = payload.access_token || payload.id_token || session.apiToken;
  if (!nextApiToken) {
    throw new Error("Cognito Refresh-Antwort enthält kein verwendbares Access Token.");
  }

  const expiresInSeconds = typeof payload.expires_in === "number" ? payload.expires_in : 3600;
  const now = Date.now();

  const nextSession: AuthSession = {
    ...session,
    apiToken: nextApiToken,
    roleToken: payload.id_token || payload.access_token || session.roleToken || nextApiToken,
    idToken: payload.id_token || session.idToken,
    refreshToken: payload.refresh_token || session.refreshToken,
    expiresAt: now + expiresInSeconds * 1000,
    lastActivityAt: now
  };
  persistCognitoSessionBridge(nextSession);
  return nextSession;
}

export async function restoreCognitoSessionFromBridge(): Promise<AuthSession | null> {
  if (!isCognitoStorageBridgeEnabled()) {
    return null;
  }

  const refreshToken = readCookie(COGNITO_BRIDGE_REFRESH_COOKIE);
  if (!refreshToken) {
    return null;
  }

  const createdAtRaw = readCookie(COGNITO_BRIDGE_CREATED_AT_COOKIE);
  const createdAt = createdAtRaw ? Number(createdAtRaw) : Date.now();
  const { clientId } = getCognitoConfig();

  const body = new URLSearchParams();
  body.set("grant_type", "refresh_token");
  body.set("client_id", clientId);
  body.set("refresh_token", refreshToken);

  try {
    const payload = await requestOAuthToken(body);
    const nextApiToken = payload.access_token || payload.id_token;
    if (!nextApiToken) {
      clearCognitoSessionBridge();
      return null;
    }

    const expiresInSeconds = typeof payload.expires_in === "number" ? payload.expires_in : 3600;
    const now = Date.now();
    const nextSession: AuthSession = {
      apiToken: nextApiToken,
      roleToken: payload.id_token || payload.access_token || nextApiToken,
      idToken: payload.id_token,
      refreshToken: payload.refresh_token || refreshToken,
      expiresAt: now + expiresInSeconds * 1000,
      createdAt: Number.isFinite(createdAt) && createdAt > 0 ? createdAt : now,
      lastActivityAt: now,
      provider: "cognito"
    };
    persistCognitoSessionBridge(nextSession);
    return nextSession;
  } catch {
    clearCognitoSessionBridge();
    return null;
  }
}

export function getCognitoLogoutUrl() {
  if (!isCognitoConfigured()) {
    return null;
  }
  const { domain, clientId, logoutUri } = getCognitoConfig();
  const url = new URL(`${domain}/logout`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("logout_uri", logoutUri);
  return url.toString();
}
