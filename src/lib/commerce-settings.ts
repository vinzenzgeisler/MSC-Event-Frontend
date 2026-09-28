/**
 * Hilfen fuer die Steuer-/Provisionseinstellungen (Backend: api/src/commerce/pricing.ts und settings.ts).
 * Der Server rechnet massgeblich; die Vorschau hier spiegelt seine Formeln nur zur Anzeige.
 */

export type ShareBasis = "NET" | "GROSS";

export type CommerceSettingsValues = {
  saleTaxRateBp: number | null;
  commissionBp: number;
  sellerShareBasis: ShareBasis;
  sellerVatRateBp: number | null;
  artistSocialLevyBp: number;
};

/** "19", "7,5", "19 %" -> Basispunkte (1900, 750); leer -> null; ungueltig -> undefined. */
export const percentToBp = (input: string): number | null | undefined => {
  const cleaned = input.replace("%", "").trim().replace(",", ".");
  if (cleaned === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return undefined;
  return Math.round(Number(cleaned) * 100);
};

export const bpToPercent = (bp: number | null): string => (bp === null ? "" : String(bp / 100).replace(".", ","));

const BP = 10000;
const roundDiv = (numerator: number, denominator: number) => Math.floor((2 * numerator + denominator) / (2 * denominator));

export type SalePreview = {
  grossCents: number;
  netCents: number;
  taxCents: number;
  sellerShareCents: number;
  commissionCents: number;
  /** Auszahlung an einen regelbesteuerten Fotografen (Anteil plus dessen Umsatzsteuer bzw. darin enthalten). */
  regularPayoutCents: number;
  /** Auszahlung an einen Kleinunternehmer. */
  smallBusinessPayoutCents: number;
  /** Ertrag des MSC nach Umsatzsteuer, vor Zahlungsgebuehr und Kuenstlersozialabgabe. */
  regularMscCents: number;
  smallBusinessMscCents: number;
};

/** Vorschau fuer einen Preis; `null`, solange der Verkaufssteuersatz nicht gesetzt ist. */
export const previewSale = (grossCents: number, settings: CommerceSettingsValues): SalePreview | null => {
  if (settings.saleTaxRateBp === null) return null;
  const rate = settings.saleTaxRateBp;
  const taxCents = roundDiv(grossCents * rate, BP + rate);
  const netCents = grossCents - taxCents;
  const basis = settings.sellerShareBasis === "NET" ? netCents : grossCents;
  const sellerShareCents = Math.floor((basis * (BP - settings.commissionBp)) / BP);
  const commissionCents = basis - sellerShareCents;
  const vatRate = settings.sellerVatRateBp ?? rate;
  let regularVat: number;
  let regularPayout: number;
  if (settings.sellerShareBasis === "NET") {
    regularVat = roundDiv(sellerShareCents * vatRate, BP);
    regularPayout = sellerShareCents + regularVat;
  } else {
    regularVat = vatRate === 0 ? 0 : roundDiv(sellerShareCents * vatRate, BP + vatRate);
    regularPayout = sellerShareCents;
  }
  return {
    grossCents,
    netCents,
    taxCents,
    sellerShareCents,
    commissionCents,
    regularPayoutCents: regularPayout,
    smallBusinessPayoutCents: sellerShareCents,
    regularMscCents: grossCents - regularPayout - (taxCents - regularVat),
    smallBusinessMscCents: grossCents - sellerShareCents - taxCents,
  };
};

export const formatEuro = (cents: number): string => `${(cents / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

export type CommerceSettingsVersion = CommerceSettingsValues & {
  id: string;
  version: number;
  note: string | null;
  createdBy: string;
  createdAt: string;
};
