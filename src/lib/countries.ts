const countryCache = new Map<string, string[]>();

const FALLBACK_COUNTRIES = [
  "Austria",
  "Belgium",
  "Czechia",
  "Denmark",
  "France",
  "Germany",
  "Italy",
  "Luxembourg",
  "Netherlands",
  "Poland",
  "Slovakia",
  "Slovenia",
  "Sweden",
  "Switzerland",
  "United Kingdom",
  "United States"
];

function normalize(value: string) {
  return value.trim().toLocaleLowerCase();
}

export function getCountryOptions(locale: string): string[] {
  const cacheKey = locale || "en";
  const cached = countryCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const intlWithSupported = Intl as typeof Intl & {
      supportedValuesOf?: (key: string) => string[];
    };
    if (typeof Intl.DisplayNames === "function" && typeof intlWithSupported.supportedValuesOf === "function") {
      const regionCodes = intlWithSupported.supportedValuesOf("region").filter((code: string) => /^[A-Z]{2}$/.test(code) && code !== "ZZ");
      const displayNames = new Intl.DisplayNames([cacheKey], { type: "region" });

      const labels: string[] = Array.from(
        new Set(
          regionCodes
            .map((code: string) => displayNames.of(code))
            .filter((item): item is string => Boolean(item && item.trim()))
            .filter((item: string) => !/^unknown region/i.test(item))
        )
      ).sort((a: string, b: string) => a.localeCompare(b, cacheKey));

      if (labels.length > 0) {
        countryCache.set(cacheKey, labels);
        return labels;
      }
    }
  } catch {
    // fallback below
  }

  const fallback = [...FALLBACK_COUNTRIES];
  countryCache.set(cacheKey, fallback);
  return fallback;
}

export function isCountryOption(value: string, locale: string): boolean {
  const normalized = normalize(value);
  if (!normalized) {
    return false;
  }
  return getCountryOptions(locale).some((item) => normalize(item) === normalized);
}
