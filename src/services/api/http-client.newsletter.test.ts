import { afterEach, expect, it, vi } from "vitest";

vi.hoisted(() => {
  const storage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  Object.assign(globalThis, {
    window: { __MSC_RUNTIME_CONFIG__: {}, location: { origin: "http://localhost" }, localStorage: storage, sessionStorage: storage },
    localStorage: storage,
    sessionStorage: storage
  });
});

afterEach(() => {
  window.__MSC_RUNTIME_CONFIG__ = undefined;
  vi.resetModules();
});

it("routes only newsletter admin calls to the independent API", async () => {
  window.__MSC_RUNTIME_CONFIG__ = {
    apiBaseUrl: "https://event.example.test",
    newsletterApiBaseUrl: "https://newsletter.example.test"
  };
  const { buildUrl } = await import("./http-client");

  expect(buildUrl("/admin/newsletter/subscribers", { page: 2 }))
    .toBe("https://newsletter.example.test/admin/newsletter/subscribers?page=2");
  expect(buildUrl("/admin/entries"))
    .toBe("https://event.example.test/admin/entries");
});

it("keeps the existing API when no newsletter endpoint is configured", async () => {
  window.__MSC_RUNTIME_CONFIG__ = { apiBaseUrl: "https://event.example.test", newsletterApiBaseUrl: "" };
  const { buildUrl } = await import("./http-client");

  expect(buildUrl("/admin/newsletter/overview"))
    .toBe("https://event.example.test/admin/newsletter/overview");
});
