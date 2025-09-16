import * as React from "react";
import { render, screen, within, waitFor } from "@testing-library/react";
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
  saveCardDraft: vi.fn(async (_i: SaveCardDraftInput) => ({ updatedAt: new Date().toISOString() })),
  loadCardDraft: vi.fn(async (_id: UUID) => undefined),
  publishCard: vi.fn(async (_id: UUID) => {}),
}));

describe("FullScreenEditor (text card)", () => {
  it("autosaves body after debounce and calls publish", async () => {
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
    // Editor の textarea をアクセシブル名で特定（タイトル/タグ input と区別）
    const ta = screen.getByRole("textbox", { name: "Markdown を記述…" }) as HTMLTextAreaElement;
    await user.type(ta, "Hello Markdown");

    // advance debounce (500ms)
    await waitFor(async () => {
      const { saveCardDraft } = await import("@/lib/data");
      expect(saveCardDraft).toHaveBeenCalled();
    }, { timeout: 2000 });

    const { saveCardDraft, publishCard } = await import("@/lib/data");
    expect(saveCardDraft).toHaveBeenCalled();
    const last = vi.mocked(saveCardDraft).mock.calls.at(-1);
    expect(last).toBeTruthy();
    if (last) {
      const [args] = last as [SaveCardDraftInput];
      expect(args).toMatchObject({ cardId: "CARD", cardType: "text", body: "Hello Markdown" });
    }

    // publish button triggers publish + workspace mutations
    const publishBtn = screen.getByRole("button", { name: "公開" });
    await user.click(publishBtn);
    expect(publishCard).toHaveBeenCalledWith("CARD");

    const { workspaceStore } = await import("@/lib/state/workspace-store");
    expect(workspaceStore.clearDraft).toHaveBeenCalledWith("CARD");
    expect(workspaceStore.bumpVersion).toHaveBeenCalled();
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

  it("flushes draft before header back navigation", async () => {
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

    // Arrange: make saveCardDraft awaitable to assert push order
    const { saveCardDraft } = await import("@/lib/data");
    let resolveSave: ((v: { updatedAt: string }) => void) | undefined;
    const gate = new Promise<{ updatedAt: string }>((res) => { resolveSave = res; });
    vi.mocked(saveCardDraft).mockImplementationOnce(async (_i: SaveCardDraftInput) => gate);

    // Act: click header "ワークスペースに戻る"
    await user.click(screen.getByRole("button", { name: "ワークスペースに戻る" }));

    // Assert: draft save started and push not yet called
    expect(saveCardDraft).toHaveBeenCalled();
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
    const last = vi.mocked(saveCardDraft).mock.calls.at(-1);
    expect(last).toBeTruthy();
    if (last) {
      const [args] = last as [SaveCardDraftInput];
      expect(args).toMatchObject({ body: "Back flush header" });
    }
  });

  it("flushes draft before toolbar Back to Workspace", async () => {
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

    const { saveCardDraft } = await import("@/lib/data");
    let resolveSave: ((v: { updatedAt: string }) => void) | undefined;
    const gate = new Promise<{ updatedAt: string }>((res) => { resolveSave = res; });
    vi.mocked(saveCardDraft).mockImplementationOnce(async (_i: SaveCardDraftInput) => gate);

    // Open Menubar > File, click Back to Workspace
    await user.click(screen.getByRole("menuitem", { name: "File" }));
    await user.click(await screen.findByRole("menuitem", { name: "Back to Workspace" }));

    expect(saveCardDraft).toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(resolveSave).toBeDefined();
    resolveSave?.({ updatedAt: new Date().toISOString() });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/courses/COURSE/workspace"));
    const last = vi.mocked(saveCardDraft).mock.calls.at(-1);
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
    await user.click(correctButtons.at(-1)!);

    await user.click(screen.getByRole("button", { name: "選択肢2を削除" }));

    const { saveCardDraft } = await import("@/lib/data");
    await waitFor(() => {
      const last = vi.mocked(saveCardDraft).mock.calls.at(-1);
      expect(last).toBeTruthy();
      if (!last) throw new Error("No saveCardDraft call");
      const [args] = last as [SaveCardDraftInput];
      expect(args.cardType).toBe("quiz");
      if (args.cardType === "quiz") {
        expect(args.options).toEqual(["Opt1", "Opt3"]);
        expect(args.optionExplanations).toEqual(["Exp1", "Exp3"]);
        expect(args.answerIndex).toBe(1);
      }
    }, { timeout: 2000 });
  });
});
