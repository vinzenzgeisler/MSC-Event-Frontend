import { expect, test } from "@playwright/test";

test("public registration placeholder", async ({ page }) => {
  await page.goto("http://127.0.0.1:5173/anmeldung");
  await expect(page.getByText("Anmeldung (MVP-Form)")).toBeVisible();
  await page.screenshot({ path: `artifacts/rodney/screenshots/${Date.now()}-public-registration.png`, fullPage: true });
});
