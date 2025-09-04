import { test, expect } from "@playwright/test";

test("signup → login → dashboard (isolated)", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: undefined });
  const page = await ctx.newPage();
  const email = `e2e+${Date.now()}@example.com`;
  const password = "password123";
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign up/i }).click();
  await page.waitForURL("**/");

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await ctx.close();
});
