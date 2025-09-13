import { test, expect } from "@playwright/test";

test.describe("Markdown preview – sanitize", () => {
  test("dangerous HTML and protocols are sanitized", async ({ page }) => {
    await page.goto("/courses/new");
    await page.getByLabel("タイトル").fill(`E2E Sanitize ${Date.now()}`);
    await page.getByRole("button", { name: /作成/ }).click();
    await page.waitForURL(/\/courses\/.+\/workspace$/);

    await page.getByRole("textbox", { name: "新規レッスン名" }).fill("Sanitize");
    await page.getByRole("button", { name: "レッスン追加" }).click();
    await page.getByRole("button", { name: "レッスンメニュー" }).click();
    await page.getByRole("menuitem", { name: "編集" }).click();

    await page.getByRole("button", { name: "新規カードを作成" }).click();
    const region = page.getByRole("region", { name: "新規カードを作成" });
    await region.getByRole("textbox").first().fill("Sanitize Case");
    await region.locator("textarea").first().fill("seed");
    await region.getByRole("button", { name: "追加" }).click();

    await page.getByRole("treeitem", { name: /テキスト|Sanitize Case/ }).click();
    await page.getByRole("link", { name: "編集モードで開く" }).click();
    await page.waitForURL(/\/courses\/.+\/edit\/.+$/);

    // 監視: アラートなどのダイアログが出たら失敗
    page.on("dialog", async (d) => {
      await d.dismiss();
      throw new Error(`Unexpected dialog: ${d.message()}`);
    });

    const ta = page.getByRole("textbox", { name: "Markdown を記述…" });
    const payload = [
      "<script>alert('xss')</script>",
      "[link](javascript:alert(1))",
      "<img src=x onerror=alert(1) />",
      "<iframe src=\"javascript:alert(1)\"></iframe>",
    ].join("\n\n");
    await ta.fill(payload);

    // プレビューのHTMLに危険なタグ/属性/プロトコルが含まれない
    const html = await page.getByRole("article").evaluate((el) => el.innerHTML);
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/onerror=/i);
    expect(html).not.toMatch(/javascript:/i);
    expect(html).not.toMatch(/<iframe/i);
  });
});

