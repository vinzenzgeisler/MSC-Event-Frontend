const ROLE_CANDIDATE_KEYS = ["roles", "role", "cognito:groups"] as const;

function base64UrlDecode(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return atob(padded);
}

export function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) {
      return null;
    }
    return JSON.parse(base64UrlDecode(parts[1])) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function extractRoles(token: string): string[] {
  const payload = parseJwtPayload(token);
  if (!payload) {
    return [];
  }

  for (const key of ROLE_CANDIDATE_KEYS) {
    const value = payload[key];
    if (Array.isArray(value)) {
      return value.filter((item): item is string => typeof item === "string");
    }
    if (typeof value === "string") {
      return [value];
    }
  }

  return [];
}
