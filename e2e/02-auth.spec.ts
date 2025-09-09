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

  // ログインは一時的な失敗に備えて最大2回までリトライ
  let ok = false;
  for (let attempt = 1; attempt <= 2; attempt++) {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: /log in/i }).click();
    try {
      await page.waitForURL(/\/dashboard$/, { timeout: 20_000 });
      ok = true;
      break;
    } catch {
      // /error に飛んだら次の試行
      if (attempt === 2) throw new Error("login failed after retries");
    }
  }
  expect(ok).toBeTruthy();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await ctx.close();
});
