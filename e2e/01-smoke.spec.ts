import { test, expect } from "@playwright/test";

test("home → courses/plan ナビゲーション", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("banner")).toBeVisible();
  await page.goto("/courses/plan");
  // ページの見出しは「AI コース設計」
  await expect(page.getByRole("heading", { name: /AI\s*コース設計/i })).toBeVisible();
});
