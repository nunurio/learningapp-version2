import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Router モック
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

// client-api モック（テストごとに解像値を切替）
vi.mock("@/lib/client-api", () => ({
  snapshot: vi.fn(),
  saveProgress: vi.fn(async () => {}),
}));

import { LearningCarousel } from "./LearningCarousel";
import * as clientApi from "@/lib/client-api";
import type { MockedFunction } from "vitest";

type UUID = string;

function makeIso(n: number) {
  return new Date(2024, 0, n, 12, 0, 0).toISOString();
}

const baseCourse = { id: "c-1" as UUID, title: "Course", status: "draft" as const, createdAt: makeIso(1), updatedAt: makeIso(1) };
const otherCourse = { id: "c-2" as UUID, title: "Other", status: "draft" as const, createdAt: makeIso(1), updatedAt: makeIso(1) };

beforeEach(() => {
  push.mockClear();
  vi.mocked(clientApi.snapshot).mockReset();
  vi.mocked(clientApi.saveProgress).mockClear();
});

describe("LearningCarousel", () => {
  it("textカード: 初期レンダと理解度コミットで進捗保存", async () => {
    const l1 = { id: "l-1" as UUID, courseId: baseCourse.id, title: "L1", orderIndex: 1, createdAt: makeIso(1) };
    const l2 = { id: "l-2" as UUID, courseId: baseCourse.id, title: "L2", orderIndex: 2, createdAt: makeIso(1) };
    vi.mocked(clientApi.snapshot).mockResolvedValue({
      courses: [baseCourse, otherCourse],
      lessons: [l1, l2],
      cards: [
        { id: "card-t1", lessonId: l1.id, cardType: "text", title: "T1", content: { body: "本文A" }, orderIndex: 1, createdAt: makeIso(2) },
        { id: "card-q1", lessonId: l1.id, cardType: "quiz", title: "Q1", content: { question: "Q?", options: ["a","b"], answerIndex: 1, explanation: "exp" }, orderIndex: 2, createdAt: makeIso(3) },
        { id: "card-f1", lessonId: l2.id, cardType: "fill-blank", title: "F1", content: { text: "I [[1]] JS", answers: { "1": "love" } }, orderIndex: 3, createdAt: makeIso(4) },
        // 別コースは無視される
        { id: "x", lessonId: "other-lesson" as UUID, cardType: "text", title: "X", content: { body: "x" }, orderIndex: 1, createdAt: makeIso(1) },
      ],
      progress: [],
      flags: [],
      notes: [],
    });

    render(<LearningCarousel courseId={baseCourse.id} />);

    // スナップショット取得後の基本表示
    expect(await screen.findByText("1 / 3")).toBeInTheDocument();
    expect(screen.getByText("text")).toBeInTheDocument();
    expect(screen.getByText("本文A")).toBeInTheDocument();

    // 理解度スライダーは常時表示（text）
    const slider = screen.getByRole("slider");

    // 右キー3回で 1 -> 4 に（onValueCommit が呼ばれる）
    await userEvent.click(slider);
    await userEvent.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}");

    // saveProgress が level で呼ばれる（最後が 4）
    expect(clientApi.saveProgress).toHaveBeenCalled();
    const saveProgressMock: MockedFunction<typeof clientApi.saveProgress> = vi.mocked(clientApi.saveProgress);
    const last = saveProgressMock.mock.calls.at(-1)?.[0];
    expect(last).toBeTruthy();
    const lastChecked: NonNullable<typeof last> = last as NonNullable<typeof last>;
    expect(lastChecked).toMatchObject({ cardId: "card-t1", completed: true, answer: { level: 4 } });

    // 戻るボタンで router.push に cardId を含めたURL
    await userEvent.click(screen.getByRole("button", { name: "ワークスペースに戻る" }));
    expect(push).toHaveBeenCalledWith(`/courses/${baseCourse.id}/workspace?cardId=card-t1`);
  });

  it("quizカード: 採点で結果表示→理解度スライダー表示→コミット", async () => {
    const l1 = { id: "l-1" as UUID, courseId: baseCourse.id, title: "L1", orderIndex: 1, createdAt: makeIso(1) };
    vi.mocked(clientApi.snapshot).mockResolvedValue({
      courses: [baseCourse],
      lessons: [l1],
      cards: [
        { id: "card-q1", lessonId: l1.id, cardType: "quiz", title: "Q1", content: { question: "2+2?", options: ["3","4","5"], answerIndex: 1, explanation: "4 が正解" }, orderIndex: 1, createdAt: makeIso(2) },
      ],
      progress: [],
      flags: [],
      notes: [],
    });

    render(<LearningCarousel courseId={baseCourse.id} />);

    expect(await screen.findByText("1 / 1")).toBeInTheDocument();
    expect(screen.getByText("2+2?")).toBeInTheDocument();

    // 初期は理解度バーは非表示（quiz は採点前は表示しない）
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();

    // 選択肢を選んで Check（わざと不正解を選ぶ）
    const group = screen.getByRole("radiogroup", { name: "選択肢" });
    const radios = within(group).getAllByRole("radio");
    await userEvent.click(radios[0]); // 3 を選択
    await userEvent.click(screen.getByRole("button", { name: "採点する" }));

    // 結果と解説が表示され、saveProgress が result で呼ばれる
    expect(await screen.findByText("不正解")).toBeInTheDocument();
    expect(screen.getByText("4 が正解")).toBeInTheDocument();
    const sp1: MockedFunction<typeof clientApi.saveProgress> = vi.mocked(clientApi.saveProgress);
    const firstCall = sp1.mock.calls[0]?.[0];
    expect(firstCall).toBeTruthy();
    const firstChecked: NonNullable<typeof firstCall> = firstCall as NonNullable<typeof firstCall>;
    expect(firstChecked).toMatchObject({
      cardId: "card-q1",
      completed: false,
      answer: { selected: 0, result: "wrong" },
    });

    // 以後、理解度スライダーが表示される
    const slider = await screen.findByRole("slider");
    await userEvent.click(slider);
    await userEvent.keyboard("{ArrowRight}{ArrowRight}"); // 1 -> 3

    // 最後の呼び出しは level=3, completed=true
    const saveProgressMock2: MockedFunction<typeof clientApi.saveProgress> = vi.mocked(clientApi.saveProgress);
    const last2 = saveProgressMock2.mock.calls.at(-1)?.[0];
    expect(last2).toBeTruthy();
    const lastChecked2: NonNullable<typeof last2> = last2 as NonNullable<typeof last2>;
    expect(lastChecked2).toMatchObject({ cardId: "card-q1", completed: true, answer: { level: 3 } });
  });
});
