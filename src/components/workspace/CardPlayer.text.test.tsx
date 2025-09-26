import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { CardPlayer } from "@/components/workspace/CardPlayer";

const nowISO = new Date().toISOString();

vi.mock("@/lib/client-api", () => {
  return {
    snapshot: vi.fn(async () => ({
      courses: [{ id: "course1", title: "C1", status: "draft", createdAt: nowISO, updatedAt: nowISO }],
      lessons: [{ id: "lesson1", courseId: "course1", title: "L1", orderIndex: 0, createdAt: nowISO }],
      cards: [
        {
          id: "card1",
          lessonId: "lesson1",
          cardType: "text",
          title: null,
          tags: [],
          content: { body: "Hello world" },
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
    listNotes: vi.fn(async () => []),
    createNote: vi.fn(async () => ({ noteId: "note-new", createdAt: nowISO, updatedAt: nowISO })),
    updateNote: vi.fn(async () => ({ updatedAt: nowISO })),
    saveProgress: vi.fn(async () => {}),
  };
});

// Access mocks with types
const api = await import("@/lib/client-api");

describe("CardPlayer - Text card with understanding slider", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("スライダーで3以上にすると完了になり、理解度が表示される", async () => {
    const user = userEvent.setup();
    render(
      <CardPlayer courseId={"course1"} selectedId={"card1"} selectedKind="card" onNavigate={() => {}} />
    );

    // 初期レンダ後: 理解度 未評価 とスライダーが見える
    await screen.findByText(/理解度 未評価/);

    // Thumb をキーボードで 1→2→3 に上げる
    const thumb = document.querySelector('[data-slot="slider-thumb"]') as HTMLElement;
    expect(thumb).toBeDefined();
    thumb.focus();
    await user.keyboard("{ArrowRight}"); // 2
    await user.keyboard("{ArrowRight}"); // 3

    // saveProgress が呼ばれ、最後は completed: true, level: 3
    const mocked = vi.mocked(api);
    const calls = mocked.saveProgress.mock.calls;
    expect(calls.length).toBeGreaterThanOrEqual(2);
    const lastArg = calls.at(-1)?.[0];
    expect(lastArg).toMatchObject({ cardId: "card1", completed: true });
    const ans = lastArg?.answer as { level?: number } | undefined;
    expect(ans?.level).toBe(3);

    // 中央ラベルも "完了 / 理解度 3/5" に更新される
    await screen.findByText(/完了\s*\/\s*理解度\s*3\/5/);

    // 旧「完了」ボタンが無いこと
    expect(screen.queryByRole("button", { name: "完了" })).toBeNull();
  });
});
