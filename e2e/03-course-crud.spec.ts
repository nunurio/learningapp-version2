import { test, expect } from "@playwright/test";

test("手動コース作成 → ワークスペースへ遷移", async ({ page }) => {
  // setup project により既にログイン済み（storageState）である前提
  await page.goto("/courses/new");

  await page.getByLabel("タイトル").fill(`E2E コース ${Date.now()}`);
  await page.getByRole("button", { name: /作成/ }).click();

  // /courses/:id → /courses/:id/workspace へリダイレクト
  await page.waitForURL(/\/courses\/[0-9a-f-]{36}\/workspace$/);
  await expect(page.getByRole("heading", { level: 1, name: "学習ワークスペース" })).toBeVisible();
});

