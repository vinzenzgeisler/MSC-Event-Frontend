const DEFAULT_CONTACT_EMAIL = "nennung@msc-oberlausitzer-dreilaendereck.eu";
const DEFAULT_WEBSITE_URL = "https://msc-oberlausitzer-dreilaendereck.eu";

function readEnvValue(name: string, fallback: string): string {
  const rawValue = String(import.meta.env[name] ?? "").trim();
  return rawValue || fallback;
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

export const publicContactEmail = readEnvValue("VITE_PUBLIC_CONTACT_EMAIL", DEFAULT_CONTACT_EMAIL);
export const publicWebsiteUrl = normalizeWebsiteUrl(readEnvValue("VITE_PUBLIC_WEBSITE_URL", DEFAULT_WEBSITE_URL));
