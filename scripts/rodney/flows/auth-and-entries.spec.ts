import { expect, test } from "@playwright/test";

test("auth and entries placeholder", async ({ page }) => {
  await page.goto("http://127.0.0.1:5173/admin/login");
  await page.fill("#token", "dev-token");
  await page.click("text=Einloggen");
  await page.waitForURL("**/admin/entries");
  await expect(page.getByText("Nennungen")).toBeVisible();
  await page.screenshot({ path: `artifacts/rodney/screenshots/${Date.now()}-entries.png`, fullPage: true });
});
