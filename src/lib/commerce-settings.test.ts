import { describe, expect, it } from "vitest";
import { bpToPercent, formatEuro, percentToBp, previewSale, type CommerceSettingsValues } from "./commerce-settings";

const settings = (overrides: Partial<CommerceSettingsValues> = {}): CommerceSettingsValues => ({
  saleTaxRateBp: 1900,
  commissionBp: 2000,
  sellerShareBasis: "NET",
  sellerVatRateBp: null,
  artistSocialLevyBp: 0,
  ...overrides,
});

describe("percent conversion", () => {
  it("parses German and English input into basis points", () => {
    expect(percentToBp("19")).toBe(1900);
    expect(percentToBp("7,5")).toBe(750);
    expect(percentToBp(" 4.9 % ")).toBe(490);
    expect(percentToBp("0")).toBe(0);
  });

  it("treats empty input as unset and rejects invalid input", () => {
    expect(percentToBp("")).toBeNull();
    expect(percentToBp("   ")).toBeNull();
    expect(percentToBp("abc")).toBeUndefined();
    expect(percentToBp("-5")).toBeUndefined();
    expect(percentToBp("1,234")).toBeUndefined();
  });

  it("formats basis points as German percent text", () => {
    expect(bpToPercent(1900)).toBe("19");
    expect(bpToPercent(490)).toBe("4,9");
    expect(bpToPercent(null)).toBe("");
  });

  it("formats euros", () => {
    expect(formatEuro(672)).toMatch(/^6,72\s€$/);
  });
});

describe("previewSale (mirrors the server formulas)", () => {
  it("matches the worked example: 10,00 EUR at 19 %, share of net", () => {
    const preview = previewSale(1000, settings())!;
    expect([preview.netCents, preview.taxCents, preview.sellerShareCents, preview.commissionCents]).toEqual([840, 160, 672, 168]);
    expect(preview.regularPayoutCents).toBe(800);
    expect(preview.smallBusinessPayoutCents).toBe(672);
  });

  it("keeps the MSC share independent of the seller tax status when based on net", () => {
    for (const price of [500, 1000, 1500, 2000]) {
      for (const rate of [0, 700, 1900]) {
        const preview = previewSale(price, settings({ saleTaxRateBp: rate }))!;
        expect(preview.regularMscCents).toBe(preview.commissionCents);
        expect(preview.smallBusinessMscCents).toBe(preview.commissionCents);
      }
    }
  });

  it("shows the gross-based model's dependence on the seller status", () => {
    const preview = previewSale(1000, settings({ sellerShareBasis: "GROSS" }))!;
    expect(preview.sellerShareCents).toBe(800);
    expect(preview.regularPayoutCents).toBe(800);
    expect(preview.smallBusinessMscCents).toBe(40);
    expect(preview.regularMscCents).toBeGreaterThan(preview.smallBusinessMscCents);
  });

  it("uses a separate seller VAT rate when configured", () => {
    const preview = previewSale(1000, settings({ sellerVatRateBp: 700 }))!;
    expect(preview.regularPayoutCents).toBe(719);
  });

  it("returns nothing while the sale tax rate is undecided", () => {
    expect(previewSale(1000, settings({ saleTaxRateBp: null }))).toBeNull();
  });
});
