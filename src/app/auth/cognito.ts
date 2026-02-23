import type { AuthSession } from "@/app/auth/auth-store";

const COGNITO_STATE_KEY = "msc_cognito_oauth_state";
const COGNITO_VERIFIER_KEY = "msc_cognito_pkce_verifier";
const COGNITO_RETURN_TO_KEY = "msc_cognito_return_to";

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
  return String(import.meta.env.VITE_COGNITO_ENABLED || "false").toLowerCase() === "true";
}

export function getCognitoConfig() {
  const domain = String(import.meta.env.VITE_COGNITO_DOMAIN || "").trim().replace(/\/$/, "");
  const clientId = String(import.meta.env.VITE_COGNITO_CLIENT_ID || "").trim();
  const redirectUri = String(import.meta.env.VITE_COGNITO_REDIRECT_URI || "").trim() || `${window.location.origin}/admin/login`;
  const logoutUri = String(import.meta.env.VITE_COGNITO_LOGOUT_URI || "").trim() || `${window.location.origin}/admin/login`;
  const scope = String(import.meta.env.VITE_COGNITO_SCOPES || "").trim() || "openid email profile";

  return {
    domain,
    clientId,
    redirectUri,
    logoutUri,
    scope
  };
}

export function isCognitoConfigured() {
  if (!isCognitoEnabled()) {
    return false;
  }
  const { domain, clientId } = getCognitoConfig();
  return Boolean(domain && clientId);
}

export function shouldShowManualTokenLogin() {
  const manualEnabled = String(import.meta.env.VITE_ADMIN_ENABLE_TOKEN_LOGIN || "false").toLowerCase() === "true";
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
  const enabled = String(import.meta.env.VITE_ADMIN_ENABLE_ROLE_PREVIEW || "false").toLowerCase() === "true";
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

  const { domain, clientId, redirectUri } = getCognitoConfig();

  const body = new URLSearchParams();
  body.set("grant_type", "authorization_code");
  body.set("client_id", clientId);
  body.set("code", code);
  body.set("redirect_uri", redirectUri);
  body.set("code_verifier", verifier);

  const response = await fetch(`${domain}/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: body.toString()
  });

  const payload = (await response.json()) as OAuthTokenResponse;
  clearPkceState();

  if (!response.ok || payload.error) {
    throw new Error(payload.error_description || payload.error || "Cognito Token-Austausch fehlgeschlagen.");
  }

  const apiToken = payload.access_token || payload.id_token;
  if (!apiToken) {
    throw new Error("Cognito Antwort enthält kein verwendbares Access Token.");
  }

  const expiresInSeconds = typeof payload.expires_in === "number" ? payload.expires_in : 3600;

  return {
    apiToken,
    roleToken: payload.id_token || payload.access_token,
    idToken: payload.id_token,
    refreshToken: payload.refresh_token,
    expiresAt: Date.now() + expiresInSeconds * 1000,
    provider: "cognito"
  };
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
