import type { PublicPricingRules } from "@/types/registration";

export type PublicRegistrationPhase = "early" | "late" | "closed" | "unknown";

export type PriceRange = {
  minCents: number;
  maxCents: number;
  currency: string;
};

export type PublicPricingSnapshot = {
  phase: PublicRegistrationPhase;
  entryPrice: PriceRange | null;
  secondVehiclePrice: PriceRange | null;
  deadlineAt: Date | null;
};

function asDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function asPriceRange(values: number[], currency: string): PriceRange | null {
  if (!values.length) {
    return null;
  }
  const filtered = values.filter((item) => Number.isFinite(item));
  if (!filtered.length) {
    return null;
  }
  return {
    minCents: Math.max(0, Math.min(...filtered)),
    maxCents: Math.max(0, Math.max(...filtered)),
    currency
  };
}

export function resolvePublicPricing(pricingRules: PublicPricingRules | null, registrationCloseAtIso: string | null, now = new Date()): PublicPricingSnapshot {
  if (!pricingRules || !pricingRules.classRules.length) {
    return {
      phase: "unknown",
      entryPrice: null,
      secondVehiclePrice: null,
      deadlineAt: asDate(registrationCloseAtIso)
    };
  }

  const earlyDeadline = asDate(pricingRules.earlyDeadline);
  const registrationCloseAt = asDate(registrationCloseAtIso);
  const currency = pricingRules.currency || "EUR";
  const baseFees = pricingRules.classRules.map((item) => item.baseFeeCents);

  let phase: PublicRegistrationPhase = "unknown";
  if (registrationCloseAt && now.getTime() > registrationCloseAt.getTime()) {
    phase = "closed";
  } else if (earlyDeadline && now.getTime() > earlyDeadline.getTime()) {
    phase = "late";
  } else {
    phase = "early";
  }

  const lateSurcharge = phase === "late" || phase === "closed" ? pricingRules.lateFeeCents : 0;
  const entryPriceCents = baseFees.map((base) => Math.max(0, base + lateSurcharge));
  const secondVehiclePriceCents = entryPriceCents.map((entry) => Math.max(0, entry - pricingRules.secondVehicleDiscountCents));

  return {
    phase,
    entryPrice: asPriceRange(entryPriceCents, currency),
    secondVehiclePrice: asPriceRange(secondVehiclePriceCents, currency),
    deadlineAt: phase === "early" ? earlyDeadline ?? registrationCloseAt : registrationCloseAt
  };
}

function toIntlLocale(locale: string) {
  if (locale === "cz") return "cs-CZ";
  if (locale === "en") return "en-US";
  return "de-DE";
}

export function formatCurrency(locale: string, amountCents: number, currency: string) {
  return new Intl.NumberFormat(toIntlLocale(locale), {
    style: "currency",
    currency: currency || "EUR"
  }).format(amountCents / 100);
}

export function formatPriceRange(locale: string, range: PriceRange): string {
  const min = formatCurrency(locale, range.minCents, range.currency);
  if (range.minCents === range.maxCents) {
    return min;
  }
  const max = formatCurrency(locale, range.maxCents, range.currency);
  if (locale === "en") {
    return `${min} to ${max}`;
  }
  return `${min} bis ${max}`;
}
