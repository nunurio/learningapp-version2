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

  // 3) カードを3枚追加（APIで確実に作成: Text / Quiz / Fill‑blank）
  // Text（先頭）
  await page.request.post("/api/db", {
    data: { op: "addCard", params: { lessonId, card: { cardType: "text", title: null, content: { body: "本文A" } } } },
  });
  // Quiz（2枚目）
  await page.request.post("/api/db", {
    data: {
      op: "addCard",
      params: {
        lessonId,
        card: { cardType: "quiz", title: null, content: { question: "2+2?", options: ["3", "4"], answerIndex: 1, explanation: "4 が正解" } },
      },
    },
  });
  // Fill‑blank（3枚目）
  await page.request.post("/api/db", {
    data: { op: "addCard", params: { lessonId, card: { cardType: "fill-blank", title: null, content: { text: "I [[1]] JS", answers: { "1": "love" } } } } },
  });

  // サーバー順序を取得して合計枚数と各インデックスを確定
  const listRes = await page.request.post("/api/db", { data: { op: "listCards", params: { lessonId } } });
  const cardsOrdered = (await listRes.json()) as unknown as Array<{ id: string; cardType: string }>;
  const totalCards = cardsOrdered.length;
  const quizIndex = Math.max(0, cardsOrdered.findIndex((c) => c.cardType === "quiz"));
  const fillIndex = cardsOrdered.findIndex((c) => c.cardType === "fill-blank");

  // 4) 学習モードへ（選択中のレッスンをスコープ）
  await page.goto(`/learn/${courseId}?lessonId=${lessonId}`);
  await page.waitForURL(new RegExp(`/learn/${courseId}\\?lessonId=${lessonId}`));
  // スライドが期待枚数ロードされるまで待機
  await page.waitForFunction((n) => document.querySelectorAll('[data-slot="carousel-item"]').length === n, totalCards, { timeout: 20_000 });

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

  // ノート: 複数メモの作成・更新・削除
  const noteTrigger = page
    .getByRole("group")
    .filter({ hasText: /本文A/ })
    .getByRole("button", { name: "ノート" });
  await expect(noteTrigger).toBeVisible({ timeout: 20_000 });
  await noteTrigger.click();
  const noteDialog = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "ノート" }) });
  await expect(noteDialog).toBeVisible();
  const noteNewSection = noteDialog.getByTestId("note-dialog-new");
  await noteNewSection.getByPlaceholder("新しいメモを入力…").fill("Note A");
  await noteNewSection.getByRole("button", { name: "追加" }).click();
  const noteList = noteDialog.getByTestId("note-dialog-list");
  await expect(noteList.getByText("Note A")).toBeVisible();
  const noteEditorTextarea = noteDialog.locator('textarea[placeholder="メモ…"]').first();
  await noteEditorTextarea.fill("Note A updated");
  await noteDialog.getByRole("button", { name: "保存" }).click();
  await expect(noteList.getByText("Note A updated")).toBeVisible();
  await noteNewSection.getByPlaceholder("新しいメモを入力…").fill("Note B");
  await noteNewSection.getByRole("button", { name: "追加" }).click();
  const noteBItem = noteList.locator('[data-testid^="note-dialog-item-"]').filter({ hasText: "Note B" });
  await expect(noteBItem).toBeVisible();
  await noteBItem.getByRole("button", { name: "削除" }).click();
  await page.getByRole("button", { name: "削除する" }).click();
  await expect(noteList.locator('text=Note B')).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(noteDialog).toBeHidden();

  // Quizへ移動（インデックスに合わせて必要回数だけ次へ）
  for (let i = 1; i <= quizIndex; i++) {
    await next.click();
  }
  await expect(page.getByText(new RegExp(`^${quizIndex + 1} / ${totalCards}$`))).toBeVisible();
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
  if (fillIndex !== -1) {
    // Fillカード位置まで移動
    for (let i = quizIndex + 1; i <= fillIndex; i++) {
      await next.click();
    }
    await expect(page.getByText(new RegExp(`^${fillIndex + 1} / ${totalCards}$`))).toBeVisible();
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

  // インスペクタでメモが共有されていることを確認し、再度CRUDを行う
  const textCardTreeItem = page.getByRole("treeitem", { name: /テキスト/ }).first();
  await textCardTreeItem.click();
  await expect(page.getByTestId("note-list-card").getByText("Note A updated")).toBeVisible({ timeout: 20_000 });
  const inspectorNoteTextarea = page.getByLabel("選択中のメモ");
  await expect(inspectorNoteTextarea).toBeVisible({ timeout: 20_000 });
  await expect(inspectorNoteTextarea).toHaveValue("Note A updated");
  await inspectorNoteTextarea.fill("Inspector note");
  await page.getByTestId("note-editor-card").getByRole("button", { name: "保存" }).click();
  await expect(page.getByTestId("note-list-card").getByText("Inspector note")).toBeVisible();
  await page.getByLabel("新規メモ").fill("Second inspector note");
  await page.getByTestId("note-editor-card").getByRole("button", { name: "追加" }).click();
  const inspectorNewItem = page.locator('[data-testid^="note-item-"]').filter({ hasText: "Second inspector note" });
  await expect(inspectorNewItem).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('[data-testid^="note-item-temp"]').filter({ hasText: "Second inspector note" })).toHaveCount(0, { timeout: 20_000 });
  const stableInspectorNewItem = page.locator('[data-testid^="note-item-"]').filter({ hasText: "Second inspector note" }).first();
  const inspectorMenuButton = stableInspectorNewItem.getByRole("button", { name: "メモメニュー" });
  await inspectorMenuButton.focus();
  await inspectorMenuButton.press("Enter");
  const deleteMenuItem = page.getByRole("menuitem", { name: "削除" }).first();
  await expect(deleteMenuItem).toBeVisible({ timeout: 20_000 });
  await deleteMenuItem.click();
  await page.getByRole("button", { name: "削除する" }).click();
  await expect(page.getByTestId("note-list-card").locator('text=Second inspector note')).toHaveCount(0);
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
