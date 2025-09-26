import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { CardPlayer } from "@/components/workspace/CardPlayer";

const nowISO = new Date(2024, 0, 1, 9, 0, 0).toISOString();

vi.mock("@/lib/client-api", () => ({
  snapshot: vi.fn(async () => ({
    courses: [{ id: "course-1", title: "Course", status: "draft", createdAt: nowISO, updatedAt: nowISO }],
    lessons: [{ id: "lesson-1", courseId: "course-1", title: "Lesson", orderIndex: 0, createdAt: nowISO }],
    cards: [
      {
        id: "card-1",
        lessonId: "lesson-1",
        cardType: "text",
        title: "Card",
        tags: [],
        content: { body: "memo" },
        orderIndex: 0,
        createdAt: nowISO,
      },
    ],
    progress: [],
    flags: [],
    notes: [],
  })),
  listFlaggedByCourse: vi.fn(async () => []),
  toggleFlag: vi.fn(async () => false),
  listNotes: vi.fn(async () => [
    { id: "note-1", cardId: "card-1", text: "既存", createdAt: nowISO, updatedAt: nowISO },
  ]),
  createNote: vi.fn(async () => ({ noteId: "note-2", createdAt: nowISO, updatedAt: nowISO })),
  updateNote: vi.fn(async () => ({ updatedAt: nowISO })),
  deleteNote: vi.fn(async () => {}),
  saveProgress: vi.fn(async () => {}),
}));

const api = await import("@/lib/client-api");

describe("CardPlayer notes dialog integration", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.mocked(api.listNotes).mockClear();
    vi.mocked(api.createNote).mockClear();
  });

  it("カード読込時にメモを取得し、ダイアログから追加するとアイコンが塗りつぶされる", async () => {
    const user = userEvent.setup();
    render(
      <CardPlayer courseId="course-1" selectedId="card-1" selectedKind="card" />
    );

    // 初期ロードで listNotes が呼ばれ、アイコンが塗りつぶされる
    await waitFor(() => {
      expect(api.listNotes).toHaveBeenCalledWith("card-1");
    });

    const noteButton = screen.getByRole("button", { name: "ノート" });
    const icon = noteButton.querySelector("svg");
    expect(icon).not.toBeNull();
    expect(icon?.classList.contains("fill-current")).toBe(true);

    await user.click(noteButton);

    const textarea = await screen.findByPlaceholderText("新しいメモを入力…");
    await user.type(textarea, "追加分");
    await user.click(screen.getByRole("button", { name: "追加" }));

    await waitFor(() => {
      expect(api.createNote).toHaveBeenCalledWith("card-1", "追加分");
    });

    // 新しいメモ欄が表示され、アイコンは塗りつぶされたまま
    await screen.findByDisplayValue("追加分");
    const iconAfter = noteButton.querySelector("svg");
    expect(iconAfter?.classList.contains("fill-current")).toBe(true);
  });
});
