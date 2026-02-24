export type PublicRegistrationPhase = "early" | "late" | "closed" | "unknown";

type PublicPricingConfig = {
  earlyPriceEur: number | null;
  latePriceEur: number | null;
  secondVehiclePriceEur: number | null;
  phaseSwitchAt: Date | null;
};

export type PublicPricingSnapshot = {
  phase: PublicRegistrationPhase;
  basePriceEur: number | null;
  secondVehiclePriceEur: number | null;
  deadlineAt: Date | null;
};

function parseOptionalNumber(raw: string | undefined): number | null {
  if (!raw) {
    return null;
  }
  const normalized = raw.trim().replace(",", ".");
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

function parseOptionalDate(raw: string | undefined): Date | null {
  if (!raw) {
    return null;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

let cachedConfig: PublicPricingConfig | null = null;

function getConfig(): PublicPricingConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  cachedConfig = {
    earlyPriceEur: parseOptionalNumber(import.meta.env.VITE_PUBLIC_PRICE_EARLY_EUR),
    latePriceEur: parseOptionalNumber(import.meta.env.VITE_PUBLIC_PRICE_LATE_EUR),
    secondVehiclePriceEur: parseOptionalNumber(import.meta.env.VITE_PUBLIC_PRICE_SECOND_VEHICLE_EUR),
    phaseSwitchAt: parseOptionalDate(import.meta.env.VITE_PUBLIC_PRICE_PHASE_SWITCH_AT)
  };
  return cachedConfig;
}

export function resolvePublicPricing(registrationCloseAtIso: string | null, now = new Date()): PublicPricingSnapshot {
  const config = getConfig();
  const closeAt = parseOptionalDate(registrationCloseAtIso ?? undefined);

  if (closeAt && now.getTime() > closeAt.getTime()) {
    return {
      phase: "closed",
      basePriceEur: config.latePriceEur ?? config.earlyPriceEur,
      secondVehiclePriceEur: config.secondVehiclePriceEur,
      deadlineAt: closeAt
    };
  }

  if (config.phaseSwitchAt && now.getTime() >= config.phaseSwitchAt.getTime()) {
    return {
      phase: "late",
      basePriceEur: config.latePriceEur ?? config.earlyPriceEur,
      secondVehiclePriceEur: config.secondVehiclePriceEur,
      deadlineAt: closeAt
    };
  }

  if (config.earlyPriceEur !== null || config.latePriceEur !== null) {
    return {
      phase: "early",
      basePriceEur: config.earlyPriceEur ?? config.latePriceEur,
      secondVehiclePriceEur: config.secondVehiclePriceEur,
      deadlineAt: config.phaseSwitchAt ?? closeAt
    };
  }

  return {
    phase: "unknown",
    basePriceEur: null,
    secondVehiclePriceEur: config.secondVehiclePriceEur,
    deadlineAt: config.phaseSwitchAt ?? closeAt
  };
}

export function formatEuro(locale: string, amountEur: number): string {
  const normalizedLocale = locale === "cz" ? "cs-CZ" : locale === "en" ? "en-US" : "de-DE";
  return new Intl.NumberFormat(normalizedLocale, {
    style: "currency",
    currency: "EUR"
  }).format(amountEur);
}
