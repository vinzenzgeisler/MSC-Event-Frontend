import { expect, test } from "@playwright/test";

test("phase0 smoke", async ({ page }) => {
  await page.goto("http://127.0.0.1:5173/anmeldung");
  await expect(page.getByText("Öffentliche Anmeldung")).toBeVisible();
  await page.screenshot({ path: `artifacts/rodney/screenshots/${Date.now()}-anmeldung.png`, fullPage: true });

  await page.goto("http://127.0.0.1:5173/admin/login");
  await expect(page.getByText("Admin Login")).toBeVisible();
  await page.screenshot({ path: `artifacts/rodney/screenshots/${Date.now()}-admin-login.png`, fullPage: true });
});
