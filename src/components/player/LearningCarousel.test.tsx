import React from "react";
import { render, screen, within, waitFor } from "@testing-library/react";
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
  listNotes: vi.fn(async () => []),
  createNote: vi.fn(async () => ({ noteId: "note-mock", createdAt: new Date(2024, 0, 1).toISOString(), updatedAt: new Date(2024, 0, 1).toISOString() })),
  updateNote: vi.fn(async () => ({ updatedAt: new Date(2024, 0, 2).toISOString() })),
  deleteNote: vi.fn(async () => {}),
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
  vi.mocked(clientApi.listNotes).mockReset();
  vi.mocked(clientApi.createNote).mockClear();
  vi.mocked(clientApi.updateNote).mockClear();
  vi.mocked(clientApi.deleteNote).mockClear();
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
        { id: "card-q1", lessonId: l1.id, cardType: "quiz", title: "Q1", content: { question: "Q?", options: ["a","b"], answerIndex: 1, explanation: "exp", optionExplanations: ["a は不正解", "b が正解"], hint: "B の特徴を思い出して" }, orderIndex: 2, createdAt: makeIso(3) },
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

  it("ノートダイアログでメモを一覧・更新・追加できる", async () => {
    const lesson = { id: "l-note" as UUID, courseId: baseCourse.id, title: "Lesson", orderIndex: 1, createdAt: makeIso(1) };
    const cardId = "card-note" as UUID;
    const createdAt = makeIso(2);
    vi.mocked(clientApi.snapshot).mockResolvedValue({
      courses: [baseCourse],
      lessons: [lesson],
      cards: [
        { id: cardId, lessonId: lesson.id, cardType: "text", title: "T", content: { body: "memo" }, orderIndex: 1, createdAt: makeIso(2) },
      ],
      progress: [],
      flags: [],
      notes: [
        { id: "note-1", cardId, text: "既存メモ", createdAt, updatedAt: createdAt },
      ],
    });
    vi.mocked(clientApi.listNotes).mockResolvedValue([
      { id: "note-1", cardId, text: "既存メモ", createdAt, updatedAt: createdAt },
    ]);
    vi.mocked(clientApi.updateNote).mockResolvedValue({ updatedAt: makeIso(3) });
    vi.mocked(clientApi.createNote).mockResolvedValue({ noteId: "note-2", createdAt: makeIso(4), updatedAt: makeIso(4) });

    render(<LearningCarousel courseId={baseCourse.id} />);

    expect(await screen.findByText("1 / 1")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "ノート" }));

    await waitFor(() => {
      expect(clientApi.listNotes).toHaveBeenCalledWith(cardId);
    });

    const textarea = await screen.findByDisplayValue("既存メモ");
    await userEvent.clear(textarea);
    await userEvent.type(textarea, "更新後メモ");
    await userEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(clientApi.updateNote).toHaveBeenCalledWith("note-1", { text: "更新後メモ" });

    const newNoteBox = screen.getByPlaceholderText("新しいメモを入力…");
    await userEvent.type(newNoteBox, "新規メモ");
    await userEvent.click(screen.getByRole("button", { name: "追加" }));
    await waitFor(() => {
      expect(clientApi.createNote).toHaveBeenCalledWith(cardId, "新規メモ");
    });

    const newNoteTextarea = await screen.findByDisplayValue("新規メモ");
    await waitFor(() => {
      expect(document.activeElement).toBe(newNoteTextarea);
    });
    expect(newNoteBox).toHaveValue("");
  });

  it("quizカード: 採点で結果表示→理解度スライダー表示→コミット", async () => {
    const l1 = { id: "l-1" as UUID, courseId: baseCourse.id, title: "L1", orderIndex: 1, createdAt: makeIso(1) };
    vi.mocked(clientApi.snapshot).mockResolvedValue({
      courses: [baseCourse],
      lessons: [l1],
      cards: [
        { id: "card-q1", lessonId: l1.id, cardType: "quiz", title: "Q1", content: { question: "2+2?", options: ["3","4","5"], answerIndex: 1, explanation: "4 が正解", optionExplanations: ["3 は 1 小さい", "4 が正解", "5 は 1 大きい"], hint: "偶数同士の加算を考える" }, orderIndex: 1, createdAt: makeIso(2) },
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

    // Hint ボタンでヒントが表示される
    const hintButton = screen.getByRole("button", { name: "ヒントを表示" });
    await userEvent.click(hintButton);
    expect(await screen.findByText("偶数同士の加算を考える")).toBeInTheDocument();

    // 選択肢を選んで Check（わざと不正解を選ぶ）
    const group = screen.getByRole("radiogroup", { name: "選択肢" });
    const radios = within(group).getAllByRole("radio");
    await userEvent.click(radios[0]); // 3 を選択
    await userEvent.click(screen.getByRole("button", { name: "採点する" }));

    // 結果と解説が表示され、saveProgress が result で呼ばれる
    expect(await screen.findByText("不正解")).toBeInTheDocument();
    expect(screen.getAllByText("4 が正解")).toHaveLength(2);
    expect(screen.getByText("あなたの回答")).toBeInTheDocument();
    expect(screen.getByText("3 は 1 小さい")).toBeInTheDocument();
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

  it("quizカードでMarkdownとLaTeXがレンダリングされる", async () => {
    const lesson = { id: "l-quiz" as UUID, courseId: baseCourse.id, title: "Lesson", orderIndex: 1, createdAt: makeIso(1) };
    vi.mocked(clientApi.snapshot).mockResolvedValue({
      courses: [baseCourse],
      lessons: [lesson],
      cards: [
        {
          id: "quiz-md",
          lessonId: lesson.id,
          cardType: "quiz",
          title: "Q",
          content: {
            question: "**公式**は $E = mc^2$ です",
            options: ["**正解**", "選択肢 $\\alpha$"],
            answerIndex: 0,
            explanation: "**強調**",
            optionExplanations: ["$\\alpha$ の説明", "もう一方"],
          },
          orderIndex: 0,
          createdAt: makeIso(2),
        },
      ],
      progress: [],
      flags: [],
      notes: [],
    });

    const { container } = render(<LearningCarousel courseId={baseCourse.id} />);

    await screen.findByRole("radiogroup", { name: "選択肢" });
    await waitFor(() => {
      expect(container.querySelector("strong")?.textContent).toBe("公式");
    });
    const katexNodes = container.querySelectorAll("span.katex");
    expect(katexNodes.length).toBeGreaterThan(0);

    const group = await screen.findByRole("radiogroup", { name: "選択肢" });
    const radios = within(group).getAllByRole("radio");
    expect(radios.length).toBeGreaterThan(0);
    const optionHasKaTeX = radios.some((radio) => radio.querySelector("span.katex"));
    expect(optionHasKaTeX).toBe(true);
  });

  it("穴埋めカードでMarkdownがレンダリングされる", async () => {
    const lesson = { id: "l-fill" as UUID, courseId: baseCourse.id, title: "Lesson", orderIndex: 1, createdAt: makeIso(1) };
    vi.mocked(clientApi.snapshot).mockResolvedValue({
      courses: [baseCourse],
      lessons: [lesson],
      cards: [
        {
          id: "fill-md",
          lessonId: lesson.id,
          cardType: "fill-blank",
          title: "Fill",
          content: {
            text: "導出の**途中**で $\\alpha$ を利用し [[1]] に代入",
            answers: { "1": "\\beta" },
          },
          orderIndex: 0,
          createdAt: makeIso(2),
        },
      ],
      progress: [],
      flags: [],
      notes: [],
    });

    const { container } = render(<LearningCarousel courseId={baseCourse.id} initialCardId="fill-md" />);

    expect(await screen.findByPlaceholderText("#1")).toBeInTheDocument();
    await waitFor(() => {
      expect(container.querySelector("strong")?.textContent).toBe("途中");
    });
    const inlineKatex = container.querySelectorAll("span.katex");
    expect(inlineKatex.length).toBeGreaterThan(0);
  });

  it("穴埋めカードで連続文章が改行されない", async () => {
    const lesson = { id: "l-fill-inline" as UUID, courseId: baseCourse.id, title: "Lesson", orderIndex: 1, createdAt: makeIso(1) };
    const text = "二次関数 $y=ax^2+bx+c$ を平方完成すると $y=a(x-p)^2+q$ の形になる。このとき放物線の[[1]]は$(p, q)$、[[2]]は$x=p$。$a>0$なら開きは上向きで[[3]]をもち、その値は$y=q$、それを[[4]]は$x=p$でとる。$a<0$なら開きは下向きで[[5]]をもち、その値は$y=q$、それを[[6]]は$x=p$でとる。[[7]]は、$a>0$のとき$y\\ge q$、$a<0$のとき$y\\le q$。区間$[m,n]$に限定するときは、[[8]]$x=m$と[[9]]$x=n$における値、そして[[2]]が区間内にあればその値を比べて最大・最小を決める。";
    vi.mocked(clientApi.snapshot).mockResolvedValue({
      courses: [baseCourse],
      lessons: [lesson],
      cards: [
        {
          id: "fill-inline",
          lessonId: lesson.id,
          cardType: "fill-blank",
          title: "Fill",
          content: {
            text,
            answers: {
              "1": "頂点",
              "2": "軸",
              "3": "最小値",
              "4": "x=p",
              "5": "最大値",
              "6": "x=p",
              "7": "値域",
              "8": "端点",
              "9": "端点",
            },
          },
          orderIndex: 0,
          createdAt: makeIso(2),
        },
      ],
      progress: [],
      flags: [],
      notes: [],
    });

    const { container } = render(<LearningCarousel courseId={baseCourse.id} initialCardId="fill-inline" />);

    expect(await screen.findByPlaceholderText("#1")).toBeInTheDocument();
    const region = container.querySelector(".text-gray-900");
    expect(region).toBeTruthy();
    expect(region?.querySelectorAll("br")).toHaveLength(0);
    expect(region?.innerHTML.includes("\n")).toBe(false);
  });
});
