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

const okResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("adminRacepicService conversions", () => {
  it("sends the Idempotency-Key and the review note when deciding", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await adminRacepicService.decideConversion("c1", "approve", "Rechte geprüft", "key-12345678");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/admin/racepic/offer-conversions/c1/approve");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe("key-12345678");
    expect(JSON.parse(init.body as string)).toEqual({ note: "Rechte geprüft" });
  });

  it("sends the Idempotency-Key when finalizing", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse({ ok: true, finalized: true }));
    vi.stubGlobal("fetch", fetchMock);

    await adminRacepicService.finalizeConversion("c1", "key-abcdefgh");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/admin/racepic/offer-conversions/c1/finalize");
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe("key-abcdefgh");
  });

  it("filters the list by status and unwraps the conversions", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse({ ok: true, conversions: [{ id: "c1" }] }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await adminRacepicService.listConversions("READY_FOR_REVIEW");

    expect(result).toEqual([{ id: "c1" }]);
    expect((fetchMock.mock.calls[0] as [string])[0]).toContain("status=READY_FOR_REVIEW");
  });

  it("surfaces the disabled-flag error code so the page can show a hint", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResponse({ ok: false, message: "Not Found", code: "COMMERCE_DISABLED" }, 404)));

    await expect(adminRacepicService.listConversions()).rejects.toSatisfy(
      (error: unknown) => error instanceof ApiError && error.status === 404 && error.code === "COMMERCE_DISABLED",
    );
  });
});
