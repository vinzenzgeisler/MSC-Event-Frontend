const DEFAULT_CONTACT_EMAIL = "nennung@msc-oberlausitzer-dreilaendereck.eu";
const DEFAULT_WEBSITE_URL = "https://msc-oberlausitzer-dreilaendereck.eu";

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

export const publicContactEmail = DEFAULT_CONTACT_EMAIL;
export const publicWebsiteUrl = normalizeWebsiteUrl(DEFAULT_WEBSITE_URL);
