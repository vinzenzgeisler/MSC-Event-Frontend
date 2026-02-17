const TOKEN_KEY = "msc_admin_token";

let inMemoryToken: string | null = null;

export function getAuthToken() {
  if (inMemoryToken) {
    return inMemoryToken;
  }
  const token = localStorage.getItem(TOKEN_KEY);
  inMemoryToken = token;
  return token;
}

export function setAuthToken(token: string) {
  inMemoryToken = token;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken() {
  inMemoryToken = null;
  localStorage.removeItem(TOKEN_KEY);
}
