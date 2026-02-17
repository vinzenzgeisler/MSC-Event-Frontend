const required = ["VITE_API_BASE_URL"] as const;

for (const key of required) {
  if (!import.meta.env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
}

export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
  publicEventId: import.meta.env.VITE_PUBLIC_EVENT_ID || ""
} as const;
