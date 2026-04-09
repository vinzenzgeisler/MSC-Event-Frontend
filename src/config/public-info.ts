const DEFAULT_CONTACT_EMAIL = "nennung@msc-oberlausitzer-dreilaendereck.eu";
const DEFAULT_WEBSITE_URL = "https://msc-oberlausitzer-dreilaendereck.eu";

type RuntimeConfig = Partial<Record<string, string | boolean | null | undefined>>;

declare global {
  interface Window {
    __MSC_RUNTIME_CONFIG__?: RuntimeConfig;
  }
}

function readConfigValue(envKey: string, runtimeKey: string, fallback: string): string {
  const runtimeConfig = window.__MSC_RUNTIME_CONFIG__;
  const runtimeValue = runtimeConfig?.[runtimeKey] ?? runtimeConfig?.[envKey];
  if (runtimeValue !== undefined && runtimeValue !== null) {
    const normalized = String(runtimeValue).trim();
    if (normalized) {
      return normalized;
    }
  }
  const envValue = String(import.meta.env[envKey] ?? "").trim();
  return envValue || fallback;
}

function normalizeWebsiteUrl(value: string): string {
  try {
    const parsed = new URL(value);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return parsed.toString();
    }
  } catch {
    return "";
  }
  return "";
}

export const publicContactEmail = readConfigValue("VITE_PUBLIC_CONTACT_EMAIL", "publicContactEmail", DEFAULT_CONTACT_EMAIL);
export const publicWebsiteUrl = normalizeWebsiteUrl(readConfigValue("VITE_PUBLIC_WEBSITE_URL", "publicWebsiteUrl", DEFAULT_WEBSITE_URL));
