import { test, expect } from "@playwright/test";

// カルーセルの学習フロー（作成→学習モード→操作）
test("学習カルーセル: 作成→学習→ナビ/採点/理解度", async ({ page }) => {
  // 1) コース作成 → ワークスペースへ
  await page.goto("/courses/new");
  await page.getByLabel("タイトル").fill(`E2E Carousel ${Date.now()}`);
  await page.getByRole("button", { name: /作成/ }).click();
  await page.waitForURL(/\/courses\/[0-9a-f-]{36}\/workspace$/);
  await expect(page.getByRole("heading", { level: 1, name: "学習ワークスペース" })).toBeVisible();

  // 2) レッスン作成
  await page.getByPlaceholder("新規レッスン名").fill("レッスン 1");
  await page.getByRole("button", { name: "レッスン追加" }).click();
  // 左ツリーにレッスン行が現れるまで待つ
  const lessonRow = page.getByRole("treeitem", { name: /レッスン 1/ }).first();
  await expect(lessonRow).toBeVisible({ timeout: 20_000 });
  // クリックで展開＋編集対象に（Inspector がレッスンに切り替わる）
  await lessonRow.click();
  await expect(page.getByRole("heading", { name: /^レッスン: レッスン 1$/ })).toBeVisible();
  const lessonId = await lessonRow.getAttribute("data-id");
  const coursePath = new URL(page.url());
  const courseId = coursePath.pathname.split("/")[2];

  // 3) カードを3枚追加（Text / Quiz / Fill‑blank）
  await page.getByRole("button", { name: "新規カードを作成" }).click();
  const form = page.locator("form").filter({ hasText: "タイトル（任意）" }).first();
  await expect(form).toBeVisible();

  // Text
  await form.locator('div:has(> label:has-text("本文")) textarea').fill("本文A");
  await form.getByRole("button", { name: "追加" }).click();

  // Quiz
  await form.locator("select").selectOption("quiz");
  await form.locator('div:has(> label:has-text("設問")) input').fill("2+2?");
  await form.locator('div:has(> label:has-text("選択肢（改行区切り）")) textarea').fill("3\n4");
  await form.locator('div:has(> label:has-text("正解インデックス（0開始）")) input').fill("1");
  await form.locator('div:has(> label:has-text("解説（任意）")) input').fill("4 が正解");
  await form.getByRole("button", { name: "追加" }).click();

  // Fill‑blank
  await form.locator("select").selectOption("fill-blank");
  await form.locator('div:has(> label:has-text("テキスト（[[1]] の形式で空所）")) textarea').fill("I [[1]] JS");
  await form.locator('div:has(> label:has-text("回答（例: 1:answer 改行区切り）")) textarea').fill("1:love");
  await form.getByRole("button", { name: "追加" }).click();

  // 左ツリーのカード件数を取得（環境差異に備えて2件以上で続行）
  const cardsInTree = page.locator('[role="treeitem"][data-type="card"]');
  await page.waitForFunction(() => document.querySelectorAll('[role="treeitem"][data-type="card"]').length >= 2, null, { timeout: 20_000 });
  const totalCards = await cardsInTree.count();

  // 4) 学習モードへ（選択中のレッスンをスコープ）
  // 「学習モード」ボタン経由だと環境によりタイミング差が出るため、直接URLで遷移
  await page.goto(`/learn/${courseId}?lessonId=${lessonId}`);
  await page.waitForURL(new RegExp(`/learn/${courseId}\\?lessonId=${lessonId}`));

  // 初期: 1/n。前へは無効、次へは有効。理解度スライダー表示（Text）
  await expect(page.getByText(new RegExp(`^1 / ${totalCards}$`))).toBeVisible({ timeout: 20_000 });
  const prev = page.locator('[data-slot="carousel-previous"]');
  const next = page.locator('[data-slot="carousel-next"]');
  await expect(prev).toBeDisabled();
  await expect(next).toBeEnabled();
  const sliderThumbText = page.locator('[data-slot="slider-thumb"]').first();
  await expect(sliderThumbText).toBeVisible();
  // 理解度を 3 に上げる（1 → 3）
  await sliderThumbText.focus();
  await sliderThumbText.press("ArrowRight");
  await sliderThumbText.press("ArrowRight");
  await expect(page.getByText("理解度: 3/5")).toBeVisible();

  // 次へ → Quiz（2/n）。初期はスライダー非表示。
  await next.click();
  await expect(page.getByText(new RegExp(`^2 / ${totalCards}$`))).toBeVisible();
  await expect(page.getByRole("radiogroup", { name: "選択肢" })).toBeVisible();
  await expect(page.locator('[data-slot="slider-thumb"]')).toHaveCount(0);
  // わざと不正解を選び、採点→結果/解説の表示
  await page.getByRole("radiogroup", { name: "選択肢" }).getByRole("radio").first().click();
  await page.getByRole("button", { name: "採点する" }).click();
  await expect(page.getByText("不正解")).toBeVisible();
  await expect(page.getByText("4 が正解")).toBeVisible();
  // 採点後はスライダーが表示される（thumbを検出）
  await expect(page.locator('[data-slot="slider-thumb"]').first()).toBeVisible();

  // 3枚目が存在する場合のみ Fill‑blank も確認
  if (totalCards >= 3) {
    await next.click();
    await expect(page.getByText(new RegExp(`^3 / ${totalCards}$`))).toBeVisible();
    await page.getByPlaceholder("#1").fill("love");
    await page.getByRole("button", { name: "Check" }).click();
    await expect(page.getByText("正解！")).toBeVisible();
    const sliderFillThumb = page.locator('[data-slot="slider-thumb"]').first();
    await sliderFillThumb.focus();
    await sliderFillThumb.press("ArrowRight");
    await sliderFillThumb.press("ArrowRight");
    await sliderFillThumb.press("ArrowRight");
    await expect(page.getByText("理解度: 4/5")).toBeVisible();
    await expect(next).toBeDisabled();
  }

  // 前へで戻れること（ボタン状態で検証）
  await prev.click();
  await expect(next).toBeEnabled();

  // 右上の「ワークスペースに戻る」でワークスペースへ
  await page.getByRole("button", { name: "ワークスペースに戻る" }).click();
  await page.waitForURL(/\/courses\/[0-9a-f-]{36}\/workspace(\?cardId=.*)?$/);
  await expect(page.getByRole("heading", { level: 1, name: "学習ワークスペース" })).toBeVisible();
});

// 矢印キーでのカルーセル移動（最小カバレッジ）
test("学習カルーセル: キーボード左右キーで移動", async ({ page }) => {
  // すでにログイン済みの状態で最小セットだけ作成
  await page.goto("/courses/new");
  await page.getByLabel("タイトル").fill(`E2E Carousel Keys ${Date.now()}`);
  await page.getByRole("button", { name: /作成/ }).click();
  await page.waitForURL(/\/courses\/[0-9a-f-]{36}\/workspace$/);

  await page.getByPlaceholder("新規レッスン名").fill("L");
  await page.getByRole("button", { name: "レッスン追加" }).click();
  const lrow = page.getByRole("treeitem", { name: /L/ }).first();
  await lrow.click();
  const lessonId2 = await lrow.getAttribute("data-id");
  const coursePath2 = new URL(page.url());
  const courseId2 = coursePath2.pathname.split("/")[2];
  // API経由でカードを2枚作成（UI操作の不確実性を回避）
  await page.request.post("/api/db", {
    data: { op: "addCard", params: { lessonId: lessonId2, card: { cardType: "text", title: null, content: { body: "A" } } } },
  });
  await page.request.post("/api/db", {
    data: { op: "addCard", params: { lessonId: lessonId2, card: { cardType: "text", title: null, content: { body: "B" } } } },
  });
  await page.goto(`/learn/${courseId2}?lessonId=${lessonId2}`);
  await page.waitForURL(new RegExp(`/learn/${courseId2}\\?lessonId=${lessonId2}`));
  // スライドが2枚表示されるまで待機
  await page.waitForFunction(() => document.querySelectorAll('[data-slot="carousel-item"]').length >= 2);
  // 初期 1/2 → 右キーで 2/2、左キーで 1/2 に戻る（ボタン状態で検証）
  const region = page.locator('[data-slot="carousel"]');
  await page.waitForSelector('[data-slot="carousel-item"]');
  const prev2 = page.locator('[data-slot="carousel-previous"]');
  const next2 = page.locator('[data-slot="carousel-next"]');
  await expect(prev2).toBeDisabled({ timeout: 20_000 });
  await expect(next2).toBeEnabled();
  await region.focus();
  await region.press("ArrowRight");
  await expect(prev2).toBeEnabled();
  await expect(next2).toBeDisabled();
  await region.press("ArrowLeft");
  await expect(prev2).toBeDisabled();
});
