import { test, expect } from "@playwright/test";

test.describe("AIチャット", () => {
  test("ページ文脈の有無でリクエストと回答が切り替わる", async ({ page }) => {
    await page.goto("/courses/plan");

    await page.getByRole("button", { name: "AIチャットを開く" }).click();

    const dialog = page.getByRole("dialog", { name: "AI チャット" });
    await expect(dialog).toBeVisible();

    const textarea = dialog.getByPlaceholder("このページについて質問…");
    const sendButton = dialog.getByRole("button", { name: "送信" });

    await expect(sendButton).toBeDisabled();

    const firstRequestPromise = page.waitForRequest((req) =>
      req.url().endsWith("/api/ai/assistant/stream") && req.method() === "POST"
    );

    await textarea.fill("チャットのE2Eテストです");
    await sendButton.click();
    await expect(sendButton).toBeDisabled();

    const firstRequest = await firstRequestPromise;
    const firstPayload = firstRequest.postDataJSON() as {
      includePage?: boolean;
      message: string;
    };
    expect(firstPayload.includePage).toBe(true);
    expect(firstPayload.message).toContain("チャットのE2Eテスト");

    await expect(dialog.getByText("チャットのE2Eテストです", { exact: false })).toBeVisible();

    const contextNote = dialog.getByText("【参照した文脈（要約）】");
    await expect(contextNote).toHaveCount(1);
    await expect(dialog.getByText("3. 次に試すこと", { exact: false })).toBeVisible();

    const contextSwitch = dialog.getByRole("switch", { name: "ページ文脈" });
    await expect(contextSwitch).toHaveAttribute("data-state", "checked");
    await contextSwitch.click();
    await expect(contextSwitch).toHaveAttribute("data-state", "unchecked");

    const secondRequestPromise = page.waitForRequest((req) =>
      req.url().endsWith("/api/ai/assistant/stream") && req.method() === "POST"
    );

    await textarea.fill("文脈なしの質問でテスト");
    await sendButton.click();
    await expect(sendButton).toBeDisabled();

    const secondRequest = await secondRequestPromise;
    const secondPayload = secondRequest.postDataJSON() as {
      includePage?: boolean;
      message: string;
    };
    expect(secondPayload.includePage).toBe(false);
    expect(secondPayload.message).toContain("文脈なしの質問でテスト");

    await expect(dialog.getByText("質問: 文脈なしの質問でテスト", { exact: false })).toBeVisible();
    await expect(contextNote).toHaveCount(1);

    // ウィジェットを閉じても履歴が保持されることを確認
    await dialog.getByRole("button", { name: "閉じる" }).click();
    await expect(dialog).not.toBeVisible();
    await page.getByRole("button", { name: "AIチャットを開く" }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("質問: 文脈なしの質問でテスト", { exact: false })).toBeVisible();

    const reopenedSwitch = dialog.getByRole("switch", { name: "ページ文脈" });
    await expect(reopenedSwitch).toHaveAttribute("data-state", "unchecked");
    await reopenedSwitch.click();
    await expect(reopenedSwitch).toHaveAttribute("data-state", "checked");

    const thirdRequestPromise = page.waitForRequest((req) =>
      req.url().endsWith("/api/ai/assistant/stream") && req.method() === "POST"
    );

    await textarea.fill("再度文脈ありで送信");
    await sendButton.click();
    await expect(sendButton).toBeDisabled();

    const thirdRequest = await thirdRequestPromise;
    const thirdPayload = thirdRequest.postDataJSON() as {
      includePage?: boolean;
      message: string;
    };
    expect(thirdPayload.includePage).toBe(true);
    expect(thirdPayload.message).toContain("再度文脈ありで送信");

    await expect(dialog.getByText("質問: 再度文脈ありで送信", { exact: false })).toBeVisible();
    await expect(contextNote).toHaveCount(2);

    // ヘッダーをクリックしてもウィジェットが閉じないこと
    const headerButtonAncestor = await dialog
      .locator(".chat-header")
      .evaluate((node) => Boolean(node.closest("button")));
    expect(headerButtonAncestor).toBe(false);

    await dialog.getByLabel("チャットウィンドウのタイトルバー").click();
    await page.waitForTimeout(600);
    await expect(dialog).toBeVisible();
  });
});

test.describe("AIチャット (タッチ操作)", () => {
  test.use({ viewport: { width: 414, height: 896 }, hasTouch: true, isMobile: true });

  test("ヘッダーをタップしてもウィジェットが閉じない", async ({ page }) => {
    await page.goto("/courses/plan");

    const launcher = page.getByRole("button", { name: "AIチャットを開く" });
    await launcher.tap();

    const dialog = page.getByRole("dialog", { name: "AI チャット" });
    await expect(dialog).toBeVisible();

    const header = dialog.locator(".chat-header");
    await header.tap();

    await expect(dialog).toBeVisible();
  });
});
