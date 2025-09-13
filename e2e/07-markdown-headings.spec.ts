import { test, expect } from "@playwright/test";

test.describe("Markdown editor – heading toggles", () => {
  test("H2→H1→解除", async ({ page }) => {
    await page.goto("/courses/new");
    await page.getByLabel("タイトル").fill(`E2E Headings ${Date.now()}`);
    await page.getByRole("button", { name: /作成/ }).click();
    await page.waitForURL(/\/courses\/.+\/workspace$/);

    await page.getByRole("textbox", { name: "新規レッスン名" }).fill("Hトグル");
    await page.getByRole("button", { name: "レッスン追加" }).click();
    await page.getByRole("button", { name: "レッスンメニュー" }).click();
    await page.getByRole("menuitem", { name: "編集" }).click();

    await page.getByRole("button", { name: "新規カードを作成" }).click();
    const region = page.getByRole("region", { name: "新規カードを作成" });
    await region.getByRole("textbox").first().fill("Heading Case");
    await region.locator("textarea").first().fill("Heading line");
    await region.getByRole("button", { name: "追加" }).click();

    // open fullscreen editor
    await page.getByRole("treeitem", { name: /テキスト|Heading Case/ }).click();
    await page.getByRole("link", { name: "編集モードで開く" }).click();
    await page.waitForURL(/\/courses\/.+\/edit\/.+$/);

    const ta = page.getByRole("textbox", { name: "Markdown を記述…" });
    await ta.click();
    await ta.fill("Heading line");

    // H2
    await page.getByRole("button", { name: "Heading 2" }).click();
    await expect(ta).toHaveValue("## Heading line");
    await expect(page.getByRole("article").getByRole("heading", { level: 2 })).toBeVisible();

    // H1
    await page.getByRole("button", { name: "Heading 1" }).click();
    await expect(ta).toHaveValue("# Heading line");
    await expect(page.getByRole("article").getByRole("heading", { level: 1 })).toBeVisible();

    // toggle off (H1 もう一度)
    await page.getByRole("button", { name: "Heading 1" }).click();
    await expect(ta).toHaveValue("Heading line");
    await expect(page.getByRole("article").getByRole("heading")).toBeHidden();
  });
});

