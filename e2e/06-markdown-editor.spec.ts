import { test, expect } from "@playwright/test";

test.describe("Markdown editor (fullscreen)", () => {
  test("formatting toolbar, preview toggle, undo/redo", async ({ page }) => {
    // 前提: setup プロジェクトで storageState を作成済み（サインアップ+ログイン）
    await page.goto("/");

    // 1) コース作成
    await page.goto("/courses/new");
    const title = `E2E Markdown ${Date.now()}`;
    await page.getByLabel("タイトル").fill(title);
    await page.getByRole("button", { name: /作成/ }).click();
    await page.waitForURL(/\/courses\/.+\/workspace$/);

    // 2) レッスン追加
    await expect(page.getByRole("heading", { level: 1, name: "学習ワークスペース" })).toBeVisible();
    await page.getByRole("textbox", { name: "新規レッスン名" }).fill("第1回 Markdown基礎");
    await page.getByRole("button", { name: "レッスン追加" }).click();

    // 左のツリーに追加されたレッスンのメニューから「編集」を選び、Inspector をレッスン編集状態にする
    const lessonItem = page.getByRole("treeitem", { name: /第1回 Markdown基礎/ });
    await lessonItem.waitFor();
    await page.getByRole("button", { name: "レッスンメニュー" }).click();
    await page.getByRole("menuitem", { name: "編集" }).click();

    // 3) 新規カード（Text）を作成
    await page.getByRole("button", { name: "新規カードを作成" }).click();
    const region = page.getByRole("region", { name: "新規カードを作成" });
    await region.getByRole("textbox").first().fill("Hello Markdown");
    await region.locator("textarea").first().fill("Hello world");
    await page.getByRole("button", { name: "追加" }).click();

    // ツリーに作成カードが出現 → カードを選択
    const cardItem = page.getByRole("treeitem", { name: /テキスト|Hello Markdown/ });
    await cardItem.waitFor();
    await cardItem.click();

    // インスペクタに「編集モードで開く」が出る → フルスクリーンエディタへ
    const openEdit = page.getByRole("link", { name: "編集モードで開く" });
    await openEdit.waitFor();
    await openEdit.click();
    await page.waitForURL(/\/courses\/.+\/edit\/.+$/);

    // 4) 書式ボタンの検証（選択→太字→引用→箇条書き）
    const textarea = page.getByRole("textbox", { name: "Markdown を記述…" });
    await textarea.click();
    await textarea.fill("Hello world");
    const selectAll = process.platform === "darwin" ? "Meta+A" : "Control+A";
    await page.keyboard.press(selectAll);

    // Bold
    await page.getByRole("button", { name: /Bold/ }).click();
    await expect(textarea).toHaveValue("**Hello world**");

    // Blockquote
    await page.getByRole("button", { name: /Blockquote/ }).click();
    await expect(textarea).toHaveValue("> **Hello world**");
    // プレビューに blockquote/strong が現れる
    await expect(page.getByRole("article").getByRole("blockquote")).toBeVisible();
    await expect(page.getByRole("article").getByRole("strong")).toBeVisible();

    // Bullet list
    await page.getByRole("button", { name: /Bullet list/ }).click();
    await expect(textarea).toHaveValue("- > **Hello world**");
    // プレビューに listitem が現れる
    await expect(page.getByRole("article").getByRole("listitem")).toBeVisible();

    // 5) Undo/Redo
    await page.getByRole("button", { name: "Undo" }).click(); // -> "> **Hello world**"
    await expect(textarea).toHaveValue("> **Hello world**");
    await page.getByRole("button", { name: "Undo" }).click(); // -> "**Hello world**"
    await expect(textarea).toHaveValue("**Hello world**");
    await page.getByRole("button", { name: "Redo" }).click(); // -> "> **Hello world**"
    await expect(textarea).toHaveValue("> **Hello world**");

    // 6) プレビュー切替（OFF→ON）
    const previewBtn = page.getByRole("button", { name: "Preview" });
    await previewBtn.click();
    await expect(page.getByRole("article")).toBeHidden();
    await previewBtn.click();
    await expect(page.getByRole("article")).toBeVisible();
  });
});
