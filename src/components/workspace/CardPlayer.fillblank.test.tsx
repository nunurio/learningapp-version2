import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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
          id: "cardF",
          lessonId: "lesson1",
          cardType: "fill-blank",
          title: null,
          tags: [],
          content: { text: "A [[1]] B", answers: { 1: "x" }, caseSensitive: false },
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

const api = await import("@/lib/client-api");

describe("CardPlayer - Fill-blank with slider after Check", () => {
  it("Skip が無く、採点後にスライダーで5にすると完了", async () => {
    const user = userEvent.setup();
    render(
      <CardPlayer courseId={"course1"} selectedId={"cardF"} selectedKind="card" onNavigate={() => {}} />
    );

    // 入力→採点
    const input = await screen.findByPlaceholderText("#1");
    await user.type(input, "x");
    await user.click(screen.getByRole("button", { name: "Check" }));

    // 採点直後の保存: 未完了
    const mocked = vi.mocked(api);
    const first = mocked.saveProgress.mock.calls.at(0)?.[0];
    expect(first).toMatchObject({ cardId: "cardF", completed: false });
    const ans1 = first?.answer as { result?: string } | undefined;
    expect(ans1?.result).toBe("correct");

    // 理解度 5 に上げる
    const thumb = document.querySelector('[data-slot="slider-thumb"]') as HTMLElement;
    thumb.focus();
    await user.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}"); // 1→5

    const last = mocked.saveProgress.mock.calls.at(-1)?.[0];
    expect(last).toMatchObject({ cardId: "cardF", completed: true });
    const ans2 = last?.answer as { level?: number } | undefined;
    expect(ans2?.level).toBe(5);
    await screen.findByText(/完了\s*\/\s*理解度\s*5\/5/);

    // Skip ボタンは存在しない
    expect(screen.queryByRole("button", { name: /スキップ|Skip/i })).toBeNull();
  });
});
