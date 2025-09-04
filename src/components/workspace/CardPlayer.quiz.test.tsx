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
          id: "cardQ",
          lessonId: "lesson1",
          cardType: "quiz",
          title: null,
          tags: [],
          content: { question: "Q?", options: ["A", "B", "C"], answerIndex: 1 },
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
    saveNote: vi.fn(async () => {}),
    getNote: vi.fn(async () => ""),
    saveProgress: vi.fn(async () => {}),
  };
});

const api = await import("@/lib/client-api");

describe("CardPlayer - Quiz card with slider after Check", () => {
  it("Skip が無く、採点後にスライダーで3以上にすると完了", async () => {
    const user = userEvent.setup();
    render(
      <CardPlayer courseId={"course1"} selectedId={"cardQ"} selectedKind="card" onNavigate={() => {}} />
    );

    // Skip ボタンは存在しない
    expect(screen.queryByRole("button", { name: /スキップ|Skip/i })).toBeNull();

    // 選択肢を選んで採点
    const options = await screen.findAllByRole("radio");
    await user.click(options[1]); // 正解（index 1）
    await user.click(screen.getByRole("button", { name: "採点する" }));

    // 採点直後に saveProgress は未完了で呼ばれる（result を保持）
    const mocked = vi.mocked(api);
    const firstCall = mocked.saveProgress.mock.calls.at(0)?.[0];
    expect(firstCall).toMatchObject({ cardId: "cardQ", completed: false });
    const firstAns = firstCall?.answer as { selected?: number; result?: string } | undefined;
    expect(firstAns?.selected).toBe(1);
    expect(firstAns?.result).toBe("correct");

    // 理解度スライダー出現→ 1 から 4 へ上げる
    await screen.findByText(/3以上で完了/);
    const thumb = document.querySelector('[data-slot="slider-thumb"]') as HTMLElement;
    thumb.focus();
    await user.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}"); // 1→4

    const last = mocked.saveProgress.mock.calls.at(-1)?.[0];
    expect(last).toMatchObject({ cardId: "cardQ", completed: true });
    const lastAns = last?.answer as { level?: number; selected?: number; result?: string } | undefined;
    expect(lastAns?.level).toBe(4);
    expect(lastAns?.selected).toBe(1);
    expect(lastAns?.result).toBe("correct");

    await screen.findByText(/完了\s*\/\s*理解度\s*4\/5/);

    // SRS パネル（Again/Hard など）は存在しない
    expect(screen.queryByRole("button", { name: /Again|Hard|Good|Easy/i })).toBeNull();
  });
});
