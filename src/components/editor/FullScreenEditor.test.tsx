import * as React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { FullScreenEditor } from "@/components/editor/FullScreenEditor";
import type { UUID } from "@/lib/types";
import type { SaveCardDraftInput } from "@/lib/data";

// Mock next/navigation router
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/lib/state/workspace-store", () => ({
  workspaceStore: {
    setDraft: vi.fn(),
    clearDraft: vi.fn(),
    bumpVersion: vi.fn(),
    setLevel: vi.fn(),
    setActivePane: vi.fn(),
    subscribe: () => () => {},
    getSnapshot: () => ({ drafts: {}, activePane: "center", version: 0, levels: {} }),
  },
  useWorkspace: () => ({ drafts: {}, activePane: "center", version: 0, levels: {} }),
  useWorkspaceSelector: () => 0,
}));

vi.mock("@/lib/data", () => ({
  saveCard: vi.fn(async (_i: SaveCardDraftInput) => ({ updatedAt: new Date().toISOString() })),
}));

describe("FullScreenEditor (text card)", () => {
  it("saves current body via 保存 button", async () => {
    const user = userEvent.setup();
    render(
      <FullScreenEditor
        courseId={"COURSE" as unknown as UUID}
        cardId={"CARD" as unknown as UUID}
        cardType="text"
        title={null}
        body=""
      />
    );

    const ta = screen.getByRole("textbox", { name: "Markdown を記述…" }) as HTMLTextAreaElement;
    await user.type(ta, "Hello Markdown");

    const saveBtn = screen.getByRole("button", { name: "保存" });
    expect(saveBtn).not.toBeDisabled();

    const { saveCard } = await import("@/lib/data");
    await user.click(saveBtn);

    await waitFor(() => {
      expect(saveCard).toHaveBeenCalledTimes(1);
    });
    const last = vi.mocked(saveCard).mock.calls.at(-1);
    expect(last).toBeTruthy();
    if (last) {
      const [args] = last as [SaveCardDraftInput];
      expect(args).toMatchObject({ cardId: "CARD", cardType: "text", body: "Hello Markdown" });
    }

    const { workspaceStore } = await import("@/lib/state/workspace-store");
    expect(workspaceStore.clearDraft).toHaveBeenCalledWith("CARD");
    expect(workspaceStore.bumpVersion).toHaveBeenCalled();
    expect(saveBtn).toBeDisabled();
    expect(screen.getByText(/保存済み/)).toBeInTheDocument();
  });

  it("toggles preview on/off via toolbar", async () => {
    const user = userEvent.setup();
    render(
      <FullScreenEditor
        courseId={"COURSE" as unknown as UUID}
        cardId={"CARD2" as unknown as UUID}
        cardType="text"
        title={null}
        body={"# Title"}
      />
    );

    // initially preview is enabled (split view)
    expect(screen.getByRole("article")).toBeInTheDocument();

    const previewBtn = screen.getByRole("button", { name: /Preview/i });
    await user.click(previewBtn); // disable preview
    expect(screen.queryByRole("article")).toBeNull();

    await user.click(previewBtn); // enable again
    expect(screen.getByRole("article")).toBeInTheDocument();
  });

  it("saves before header back navigation", async () => {
    const user = userEvent.setup();
    push.mockClear();
    render(
      <FullScreenEditor
        courseId={"COURSE" as unknown as UUID}
        cardId={"CARD-H" as unknown as UUID}
        cardType="text"
        title={null}
        body=""
      />
    );

    const ta = screen.getByRole("textbox", { name: "Markdown を記述…" }) as HTMLTextAreaElement;
    await user.type(ta, "Back flush header");

    // Arrange: make saveCard awaitable to assert push order
    const { saveCard } = await import("@/lib/data");
    let resolveSave: ((v: { updatedAt: string }) => void) | undefined;
    const gate = new Promise<{ updatedAt: string }>((res) => { resolveSave = res; });
    vi.mocked(saveCard).mockImplementationOnce(async (_i: SaveCardDraftInput) => gate);

    // Act: click header "ワークスペースに戻る"
    await user.click(screen.getByRole("button", { name: "ワークスペースに戻る" }));

    // Assert: draft save started and push not yet called
    expect(saveCard).toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();

    // Resolve save and allow microtasks to flush
    expect(resolveSave).toBeDefined();
    resolveSave?.({ updatedAt: new Date().toISOString() });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/courses/COURSE/workspace"));

    // Latest body was passed to save
    const last = vi.mocked(saveCard).mock.calls.at(-1);
    expect(last).toBeTruthy();
    if (last) {
      const [args] = last as [SaveCardDraftInput];
      expect(args).toMatchObject({ body: "Back flush header" });
    }
  });

  it("saves before toolbar Back to Workspace", async () => {
    const user = userEvent.setup();
    push.mockClear();
    render(
      <FullScreenEditor
        courseId={"COURSE" as unknown as UUID}
        cardId={"CARD-T" as unknown as UUID}
        cardType="text"
        title={null}
        body=""
      />
    );

    const ta = screen.getByRole("textbox", { name: "Markdown を記述…" }) as HTMLTextAreaElement;
    await user.type(ta, "Back flush toolbar");

    const { saveCard } = await import("@/lib/data");
    let resolveSave: ((v: { updatedAt: string }) => void) | undefined;
    const gate = new Promise<{ updatedAt: string }>((res) => { resolveSave = res; });
    vi.mocked(saveCard).mockImplementationOnce(async (_i: SaveCardDraftInput) => gate);

    // Open Menubar > File, click Back to Workspace
    await user.click(screen.getByRole("menuitem", { name: "File" }));
    await user.click(await screen.findByRole("menuitem", { name: "Back to Workspace" }));

    expect(saveCard).toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(resolveSave).toBeDefined();
    resolveSave?.({ updatedAt: new Date().toISOString() });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/courses/COURSE/workspace"));
    const last = vi.mocked(saveCard).mock.calls.at(-1);
    expect(last).toBeTruthy();
    if (last) {
      const [args] = last as [SaveCardDraftInput];
      expect(args).toMatchObject({ body: "Back flush toolbar" });
    }
  });
  it("undo/redo navigates history snapshots", async () => {
    const user = userEvent.setup();
    render(
      <FullScreenEditor
        courseId={"COURSE" as unknown as UUID}
        cardId={"CARD3" as unknown as UUID}
        cardType="text"
        title={null}
        body=""
      />
    );
    const ta = screen.getByRole("textbox", { name: "Markdown を記述…" }) as HTMLTextAreaElement;

    // type two snapshots
    await user.type(ta, "Hello");
    expect(ta.value).toBe("Hello");
    await user.type(ta, " World");
    expect(ta.value).toBe("Hello World");

    // Undo step-by-step (per keystroke history)
    await user.click(screen.getByRole("button", { name: /Undo/i }));
    expect(ta.value).toBe("Hello Worl");
    await user.click(screen.getByRole("button", { name: /Undo/i }));
    expect(ta.value).toBe("Hello Wor");
    // Redo twice -> return to "Hello World"
    await user.click(screen.getByRole("button", { name: /Redo/i }));
    expect(ta.value).toBe("Hello Worl");
    await user.click(screen.getByRole("button", { name: /Redo/i }));
    expect(ta.value).toBe("Hello World");
  });
});

describe("FullScreenEditor (quiz card)", () => {
  it("adds and removes options with dedicated fields", async () => {
    const user = userEvent.setup();
    render(
      <FullScreenEditor
        courseId={"COURSE" as unknown as UUID}
        cardId={"QUIZ1" as unknown as UUID}
        cardType="quiz"
        title={"Quiz"}
        question={"What's new?"}
        options={["A", "B"]}
        answerIndex={0}
        optionExplanations={["", ""]}
      />
    );

    const optionInputsBefore = screen.getAllByLabelText(/選択肢 \d/);
    expect(optionInputsBefore).toHaveLength(2);
    const removeButtonsInitial = screen.getAllByRole("button", { name: /選択肢\dを削除/ });
    removeButtonsInitial.forEach((btn) => expect(btn).toBeDisabled());

    await user.click(screen.getByRole("button", { name: "選択肢を追加" }));
    expect(screen.getAllByLabelText(/選択肢 \d/)).toHaveLength(3);
    expect(screen.getAllByLabelText(/選択肢\dの解説/)).toHaveLength(3);

    const removeLast = screen.getByRole("button", { name: "選択肢3を削除" });
    expect(removeLast).not.toBeDisabled();
    await user.click(removeLast);
    expect(screen.getAllByLabelText(/選択肢 \d/)).toHaveLength(2);
  });

  it("marks the correct option and keeps explanations aligned after removal", async () => {
    const user = userEvent.setup();
    render(
      <FullScreenEditor
        courseId={"COURSE" as unknown as UUID}
        cardId={"QUIZ2" as unknown as UUID}
        cardType="quiz"
        title={"Quiz"}
        question={"Pick one"}
        options={["Opt1", "Opt2"]}
        answerIndex={0}
        optionExplanations={["Exp1", "Exp2"]}
      />
    );

    await user.click(screen.getByRole("button", { name: "選択肢を追加" }));

    const optionInputs = screen.getAllByLabelText(/選択肢 \d/);
    await user.clear(optionInputs[2]);
    await user.type(optionInputs[2], "Opt3");

    const explanationInput = screen.getByLabelText("選択肢3の解説");
    await user.clear(explanationInput);
    await user.type(explanationInput, "Exp3");

    const correctButtons = screen.getAllByRole("button", { name: "正解にする" });
    const lastCorrectButton = correctButtons[correctButtons.length - 1];
    if (!lastCorrectButton) throw new Error("正解にするボタンが見つかりません");
    await user.click(lastCorrectButton);

    await user.click(screen.getByRole("button", { name: "選択肢2を削除" }));

    const optionValues = screen.getAllByLabelText(/選択肢 \d/).map((input) => (input as HTMLInputElement).value);
    expect(optionValues).toEqual(["Opt1", "Opt3"]);
    const explanationValues = screen.getAllByLabelText(/選択肢\dの解説/).map((input) => (input as HTMLTextAreaElement).value);
    expect(explanationValues).toEqual(["Exp1", "Exp3"]);
    expect(screen.getByRole("button", { name: "正解" })).toHaveAttribute("aria-pressed", "true");
  });
});
