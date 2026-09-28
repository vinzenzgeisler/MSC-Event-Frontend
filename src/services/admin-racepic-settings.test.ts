import { afterEach, describe, expect, it, vi } from "vitest";

// http-client and auth-store read window/localStorage; the project has no DOM test environment, so stub the minimum.
vi.hoisted(() => {
  const store = new Map<string, string>();
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
  };
  Object.assign(globalThis, {
    window: { __MSC_RUNTIME_CONFIG__: {}, localStorage: storage, sessionStorage: storage, location: { origin: "http://localhost" } },
    localStorage: storage,
    sessionStorage: storage,
  });
});

import { adminRacepicService } from "./admin-racepic.service";
import { ApiError } from "./api/http-client";

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });

afterEach(() => vi.unstubAllGlobals());

const version = { id: "v1", version: 1, saleTaxRateBp: null, commissionBp: 2000, sellerShareBasis: "NET", sellerVatRateBp: null, artistSocialLevyBp: 0, note: null, createdBy: "x", createdAt: "2026-09-28T10:00:00.000Z" };

describe("adminRacepicService commerce settings", () => {
  it("loads the current version and history", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ ok: true, current: version, history: [version] })));
    const result = await adminRacepicService.getCommerceSettings();
    expect(result.current.version).toBe(1);
    expect(result.history).toHaveLength(1);
  });

  it("sends the values with the expected version and the note", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ ok: true, current: { ...version, version: 2, saleTaxRateBp: 700 } }, 201));
    vi.stubGlobal("fetch", fetchMock);
    const saved = await adminRacepicService.saveCommerceSettings(
      { saleTaxRateBp: 700, commissionBp: 2000, sellerShareBasis: "NET", sellerVatRateBp: null, artistSocialLevyBp: 0 },
      1,
      "Steuerberatung",
    );
    expect(saved.version).toBe(2);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/admin/racepic/commerce-settings");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      saleTaxRateBp: 700,
      commissionBp: 2000,
      sellerShareBasis: "NET",
      sellerVatRateBp: null,
      artistSocialLevyBp: 0,
      expectedVersion: 1,
      note: "Steuerberatung",
    });
  });

  it("surfaces a version conflict as an ApiError with status 409", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ ok: false, message: "changed", code: "SETTINGS_VERSION_CONFLICT" }, 409)));
    await expect(
      adminRacepicService.saveCommerceSettings({ saleTaxRateBp: 700, commissionBp: 2000, sellerShareBasis: "NET", sellerVatRateBp: null, artistSocialLevyBp: 0 }, 1, "x"),
    ).rejects.toSatisfy((error: unknown) => error instanceof ApiError && error.status === 409 && error.code === "SETTINGS_VERSION_CONFLICT");
  });
});
