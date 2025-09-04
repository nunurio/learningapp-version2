import { test, expect } from "@playwright/test";

test("login once and save storageState", async ({ page, context }) => {
  // 一度だけサインアップ→ログインして storageState を保存
  const email = `e2e+${Date.now()}@example.com`;
  const password = "password123";

  // Sign up（このアプリはメール確認を要求しない設定: enable_confirmations=false）
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign up/i }).click();
  // ホームへ戻る仕様
  await page.waitForURL("**/");

  // Log in
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await context.storageState({ path: "playwright/.auth/user.json" });
});

