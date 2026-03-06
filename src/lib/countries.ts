type SupportedLocale = "de-DE" | "en-US" | "cs-CZ" | "pl-PL";

type CountryOption = {
  code: string;
  label: string;
};

const SUPPORTED_LOCALES: SupportedLocale[] = ["de-DE", "en-US", "cs-CZ", "pl-PL"];

const COUNTRY_CODES = [
  // EU
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
  // Weitere große Länder
  "GB",
  "NO",
  "CH",
  "UA",
  "TR",
  "US",
  "CA",
  "MX",
  "BR",
  "AR",
  "CL",
  "CO",
  "PE",
  "CN",
  "IN",
  "JP",
  "KR",
  "AU",
  "NZ",
  "ZA",
  "EG",
  "NG",
  "MA",
  "SA",
  "AE",
  "QA",
  "IL"
] as const;

const LABEL_OVERRIDES: Partial<Record<(typeof COUNTRY_CODES)[number], Partial<Record<SupportedLocale, string>>>> = {
  GB: {
    "de-DE": "Vereinigtes Königreich (England, Wales, Schottland, Nordirland)",
    "en-US": "United Kingdom (England, Wales, Scotland, Northern Ireland)",
    "cs-CZ": "Spojené království (Anglie, Wales, Skotsko, Severní Irsko)",
    "pl-PL": "Wielka Brytania (Anglia, Walia, Szkocja, Irlandia Północna)"
  }
};

const ALIASES_BY_CODE: Partial<Record<(typeof COUNTRY_CODES)[number], string[]>> = {
  DE: ["Deutschland", "Germany", "Nemecko", "Německo"],
  CZ: ["Tschechien", "Czechia", "Czech Republic", "Česko", "Cesko"],
  GB: [
    "England",
    "Wales",
    "Welsh",
    "Waliser",
    "Cymru",
    "Scotland",
    "Schottland",
    "Scottish",
    "Northern Ireland",
    "Nordirland",
    "Great Britain",
    "Britain",
    "Grossbritannien",
    "Großbritannien",
    "Vereinigtes Königreich",
    "United Kingdom",
    "Anglie",
    "Velka Britanie",
    "Velká Británie",
    "Spojene kralovstvi",
    "Spojené království",
    "UK",
    "U.K.",
    "GB"
  ],
  US: ["USA", "United States", "Vereinigte Staaten", "Spojene staty", "Spojené státy"]
};

type CountryCatalog = {
  optionsByLocale: Record<SupportedLocale, CountryOption[]>;
  lookup: Map<string, string>;
  canonicalNameByCode: Map<string, string>;
};

let cachedCatalog: CountryCatalog | null = null;

function toDisplayLocale(locale: string): SupportedLocale {
  if (locale === "de" || locale === "de-DE") return "de-DE";
  if (locale === "cz" || locale === "cs" || locale === "cs-CZ") return "cs-CZ";
  if (locale === "pl" || locale === "pl-PL") return "pl-PL";
  return "en-US";
}

function normalize(value: string) {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function buildCatalog(): CountryCatalog {
  const optionsByLocale: Record<SupportedLocale, CountryOption[]> = {
    "de-DE": [],
    "en-US": [],
    "cs-CZ": [],
    "pl-PL": []
  };
  const lookup = new Map<string, string>();
  const canonicalNameByCode = new Map<string, string>();

  const displayNamesByLocale = Object.fromEntries(
    SUPPORTED_LOCALES.map((locale) => [locale, new Intl.DisplayNames([locale], { type: "region" })])
  ) as Record<SupportedLocale, Intl.DisplayNames>;

  for (const code of COUNTRY_CODES) {
    const canonical = displayNamesByLocale["en-US"].of(code) ?? code;
    canonicalNameByCode.set(code, canonical);

    lookup.set(normalize(code), code);
    lookup.set(normalize(canonical), code);

    for (const locale of SUPPORTED_LOCALES) {
      const label = LABEL_OVERRIDES[code]?.[locale] ?? displayNamesByLocale[locale].of(code) ?? canonical;
      optionsByLocale[locale].push({ code, label });
      lookup.set(normalize(label), code);
    }

    const aliases = ALIASES_BY_CODE[code] ?? [];
    for (const alias of aliases) {
      lookup.set(normalize(alias), code);
    }
  }

  for (const locale of SUPPORTED_LOCALES) {
    optionsByLocale[locale] = optionsByLocale[locale].sort((a, b) => a.label.localeCompare(b.label, locale));
  }

  return { optionsByLocale, lookup, canonicalNameByCode };
}

function getCatalog() {
  if (!cachedCatalog) {
    cachedCatalog = buildCatalog();
  }
  return cachedCatalog;
}

export function getCountrySelectOptions(locale: string): CountryOption[] {
  const displayLocale = toDisplayLocale(locale);
  return getCatalog().optionsByLocale[displayLocale];
}

export function getCountryOptions(locale: string): string[] {
  return getCountrySelectOptions(locale).map((item) => item.label);
}

export function resolveCountryCode(value: string): string | null {
  const key = normalize(value);
  if (!key) {
    return null;
  }
  return getCatalog().lookup.get(key) ?? null;
}

export function getCountryLabel(code: string, locale: string): string | null {
  const normalizedCode = resolveCountryCode(code);
  if (!normalizedCode) {
    return null;
  }
  return getCountrySelectOptions(locale).find((option) => option.code === normalizedCode)?.label ?? null;
}

export function resolveCountryToCanonical(value: string): string | null {
  const code = resolveCountryCode(value);
  if (!code) {
    return null;
  }
  return getCatalog().canonicalNameByCode.get(code) ?? null;
}

export function isCountryOption(value: string, _locale: string): boolean {
  return Boolean(resolveCountryCode(value));
}
