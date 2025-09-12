import { test, expect } from "@playwright/test";

test.describe("Markdown preview – scroll sync", () => {
  test("scrolling textarea scrolls preview", async ({ page }) => {
    await page.goto("/courses/new");
    await page.getByLabel("タイトル").fill(`E2E Scroll ${Date.now()}`);
    await page.getByRole("button", { name: /作成/ }).click();
    await page.waitForURL(/\/courses\/.+\/workspace$/);

    await page.getByRole("textbox", { name: "新規レッスン名" }).fill("ScrollSync");
    await page.getByRole("button", { name: "レッスン追加" }).click();
    await page.getByRole("button", { name: "レッスンメニュー" }).click();
    await page.getByRole("menuitem", { name: "編集" }).click();

    await page.getByRole("button", { name: "新規カードを作成" }).click();
    const region = page.getByRole("region", { name: "新規カードを作成" });
    await region.getByRole("textbox").first().fill("Scroll Case");
    await region.locator("textarea").first().fill("seed");
    await region.getByRole("button", { name: "追加" }).click();

    await page.getByRole("treeitem", { name: /テキスト|Scroll Case/ }).click();
    await page.getByRole("link", { name: "編集モードで開く" }).click();
    await page.waitForURL(/\/courses\/.+\/edit\/.+$/);

    const ta = page.getByRole("textbox", { name: "Markdown を記述…" });
    // 長文を生成（高さが十分になるように）
    const long = Array.from({ length: 400 }, (_, i) => `# H${i}\n\n${"line ".repeat(20)}`).join("\n\n");
    await ta.fill(long);

    // 初期の preview スクロール位置
    const previewStart = await page.getByRole("article").evaluate((el) => el.parentElement ? el.parentElement.scrollTop : 0);

    // textarea をスクロール（約中央）
    await ta.evaluate((el) => {
      el.scrollTop = el.scrollHeight / 2;
    });
    // 同期反映を待機
    await page.waitForTimeout(200);

    const previewMid = await page.getByRole("article").evaluate((el) => el.parentElement ? el.parentElement.scrollTop : 0);
    // スクロール位置が変化していること（方向は問わない）
    expect(Math.abs(previewMid - previewStart)).toBeGreaterThan(50);
  });
});
