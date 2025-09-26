import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Inspector } from "@/components/workspace/Inspector";
import * as clientApi from "@/lib/client-api";
import type { SaveCardDraftInput } from "@/lib/data";

const hoisted = vi.hoisted(() => {
  const now = new Date().toISOString();
  const baseSnapshot = {
    courses: [
      { id: "course1", title: "Course", status: "draft", createdAt: now, updatedAt: now },
    ],
    lessons: [
      { id: "lesson1", courseId: "course1", title: "Lesson", orderIndex: 0, createdAt: now },
    ],
    cards: [
      {
        id: "cardQ",
        lessonId: "lesson1",
        cardType: "quiz" as const,
        title: "QuizCard",
        tags: [] as string[],
        content: {
          question: "Q?",
          options: ["Opt1", "Opt2"],
          answerIndex: 0,
          explanation: "",
          optionExplanations: ["", ""],
          hint: "",
        },
        orderIndex: 0,
        createdAt: now,
      },
    ],
    progress: [] as unknown[],
    flags: [] as unknown[],
    notes: [] as unknown[],
  };
  return {
    now,
    baseSnapshot,
    snapshotMock: vi.fn(async () => baseSnapshot),
    workspaceStoreMock: {
      setDraft: vi.fn(),
      clearDraft: vi.fn(),
      bumpVersion: vi.fn(),
      setLevel: vi.fn(),
      setActivePane: vi.fn(),
      subscribe: () => () => {},
      getSnapshot: () => ({ drafts: {}, activePane: "center" as const, version: 0, levels: {} as Record<string, number | undefined> }),
    },
  };
});

vi.mock("@/lib/client-api", () => ({
  snapshot: hoisted.snapshotMock,
  addLesson: vi.fn(),
  reorderLessons: vi.fn(),
  deleteLesson: vi.fn(),
  addCard: vi.fn(),
  deleteCard: vi.fn(),
  reorderCards: vi.fn(),
  commitLessonCards: vi.fn(),
  commitLessonCardsPartial: vi.fn(),
  createNote: vi.fn(async () => ({ noteId: "note-new", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })),
  updateNote: vi.fn(async () => ({ updatedAt: new Date().toISOString() })),
  deleteNote: vi.fn(async () => {}),
}));

vi.mock("@/lib/state/workspace-store", () => ({
  workspaceStore: hoisted.workspaceStoreMock,
  useWorkspace: () => ({ drafts: {}, activePane: "center" as const, version: 0, levels: {} }),
  useWorkspaceSelector: () => 0,
}));

vi.mock("@/lib/data", () => ({
  saveCard: vi.fn(async () => ({ updatedAt: new Date().toISOString() })),
}));

vi.mock("@/components/ai/LessonCardsRunner", () => ({ LessonCardsRunner: () => null }));
vi.mock("@/components/ai/SingleCardRunner", () => ({ SingleCardRunner: () => null }));
vi.mock("@/components/ui/SSETimeline", () => ({ SSETimeline: () => null }));
vi.mock("@/components/dnd/SortableList", () => ({ SortableList: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("next/link", () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const { snapshotMock, workspaceStoreMock, baseSnapshot } = hoisted;

describe("Inspector quiz editor", () => {
  beforeEach(() => {
    snapshotMock.mockReset();
    snapshotMock.mockResolvedValue(JSON.parse(JSON.stringify(baseSnapshot)));
    workspaceStoreMock.setDraft.mockClear();
    workspaceStoreMock.clearDraft.mockClear();
    workspaceStoreMock.bumpVersion.mockClear();
    vi.mocked(clientApi.createNote).mockClear();
    vi.mocked(clientApi.updateNote).mockClear();
    vi.mocked(clientApi.deleteNote).mockClear();
  });

  it("adds and removes options with dedicated controls", async () => {
    const user = userEvent.setup();
    render(<Inspector courseId={"course1"} selectedId={"cardQ"} selectedKind="card" />);

    await screen.findByLabelText("設問");

    expect(screen.getAllByLabelText(/選択肢 \d/)).toHaveLength(2);
    screen.getAllByRole("button", { name: /選択肢\dを削除/ }).forEach((btn) => expect(btn).toBeDisabled());

    await user.click(screen.getByRole("button", { name: "選択肢を追加" }));
    expect(screen.getAllByLabelText(/選択肢 \d/)).toHaveLength(3);

    const removeThird = screen.getByRole("button", { name: "選択肢3を削除" });
    expect(removeThird).not.toBeDisabled();
    await user.type(screen.getAllByLabelText(/選択肢 \d/)[2], "Opt3");
    await user.click(removeThird);

    await waitFor(() => expect(screen.getAllByLabelText(/選択肢 \d/)).toHaveLength(2));
  });

  it("syncs explanations and correct answer after option removal", async () => {
    const user = userEvent.setup();
    render(<Inspector courseId={"course1"} selectedId={"cardQ"} selectedKind="card" />);

    await screen.findByLabelText("設問");

    await user.click(screen.getByRole("button", { name: "選択肢を追加" }));
    const optionInputs = screen.getAllByLabelText(/選択肢 \d/);
    await user.type(optionInputs[2], "Opt3");
    const explanationInput = screen.getByLabelText("選択肢3の解説");
    await user.type(explanationInput, "Expl3");

    const markButtons = screen.getAllByRole("button", { name: "正解にする" });
    const lastMarkButton = markButtons.at(-1);
    expect(lastMarkButton).toBeDefined();
    if (!lastMarkButton) {
      throw new Error("正解にするボタンが見つかりません");
    }
    await user.click(lastMarkButton);

    await user.click(screen.getByRole("button", { name: "選択肢2を削除" }));

    await waitFor(() => {
      const lastCall = workspaceStoreMock.setDraft.mock.calls.at(-1);
      expect(lastCall).toBeTruthy();
      const [draft] = lastCall as [SaveCardDraftInput];
      expect(draft.cardType).toBe("quiz");
      if (draft.cardType === "quiz") {
        expect(draft.options).toEqual(["Opt1", "Opt3"]);
        expect(draft.optionExplanations).toEqual(["", "Expl3"]);
        expect(draft.answerIndex).toBe(1);
      }
    });
  });

  it("manages multiple notes within the inspector", async () => {
    const user = userEvent.setup();
    const noteTimestamp = new Date().toISOString();
    snapshotMock.mockResolvedValueOnce({
      ...baseSnapshot,
      notes: [
        { id: "note-1", cardId: "cardQ", text: "既存メモ", createdAt: noteTimestamp, updatedAt: noteTimestamp },
      ],
    });

    render(<Inspector courseId={"course1"} selectedId={"cardQ"} selectedKind="card" />);

    const existingTextarea = await screen.findByLabelText("選択中のメモ");
    const noteEditor = screen.getByTestId("note-editor-card");
    expect(existingTextarea).toHaveValue("既存メモ");

    await user.clear(existingTextarea);
    await user.type(existingTextarea, "更新後のメモ");
    await user.click(within(noteEditor).getByRole("button", { name: "保存" }));
    await waitFor(() => {
      expect(clientApi.updateNote).toHaveBeenCalledWith("note-1", { text: "更新後のメモ" });
    });

    const newNoteTextarea = screen.getByLabelText("新規メモ");
    await user.type(newNoteTextarea, "新しいメモ");
    await user.click(within(noteEditor).getByRole("button", { name: "追加" }));
    await waitFor(() => {
      expect(clientApi.createNote).toHaveBeenCalledWith("cardQ", "新しいメモ");
    });
    expect(newNoteTextarea).toHaveValue("");

    const existingNoteItem = screen.getByTestId("note-item-note-1");
    await user.click(within(existingNoteItem).getByRole("button", { name: "メモメニュー" }));
    await user.click(await screen.findByRole("menuitem", { name: "削除" }));
    await user.click(await screen.findByRole("button", { name: "削除する" }));
    await waitFor(() => {
      expect(clientApi.deleteNote).toHaveBeenCalledWith("note-1");
    });
  });
});
