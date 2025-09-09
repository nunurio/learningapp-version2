import type { CoursePlan, LessonCards, CardType } from "@/lib/types";

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

export function createCoursePlanMock(input: {
  theme: string;
  level?: string;
  goal?: string;
  lessonCount?: number;
}): CoursePlan {
  const count = Math.max(3, Math.min(typeof input.lessonCount === "number" ? input.lessonCount : 6, 30));
  const lessons = Array.from({ length: count }).map((_, i) => ({
    title: `${input.theme} 基礎 ${i + 1}`,
    summary: `このレッスンでは「${input.theme}」の基礎トピック${i + 1}を学びます。`,
  }));
  return {
    course: {
      title: `${input.theme} 入門コース` + (input.level ? `（${input.level}）` : ""),
      description: input.goal ? `目標: ${input.goal}` : null,
      category: null,
    },
    lessons,
  };
}

export function createLessonCardsMock(input: {
  lessonTitle: string;
  desiredCount?: number;
  desiredCardType?: CardType;
  userBrief?: string;
}): LessonCards {
  const dc = typeof input.desiredCount === "number" ? input.desiredCount : 6;
  const count = Math.max(1, Math.min(dc, 20));
  const titles = ["概要", "重要概念", "例題", "小テスト", "応用", "まとめ"];
  const cards: LessonCards["cards"] = [];
  for (let i = 0; i < count; i++) {
    const idx = i % 3;
    const t = input.desiredCardType ?? (idx === 0 ? "text" : idx === 1 ? "quiz" : "fill-blank");
    if (t === "text") {
      cards.push({
        type: "text",
        title: pick(titles, i),
        body: `${input.lessonTitle} の解説セクション ${i + 1}。${input.userBrief ? `要望: ${input.userBrief}` : ""}`.trim(),
      });
    } else if (t === "quiz") {
      const options = ["A", "B", "C", "D"].map((o) => `${o}の選択肢`);
      cards.push({
        type: "quiz",
        title: pick(titles, i),
        question: `${input.lessonTitle} に関するクイズ ${i + 1}。正しいものを選んでください。`,
        options,
        answerIndex: i % options.length,
        explanation: "正解の理由を簡潔に説明します。",
      });
    } else {
      const n = (i % 2) + 1; // [[1]] or [[2]]
      cards.push({
        type: "fill-blank",
        title: pick(titles, i),
        text: `${input.lessonTitle} の重要語は [[${n}]] です。`,
        answers: { [`${n}`]: "キーワード" },
        caseSensitive: false,
      });
    }
  }
  return { lessonTitle: input.lessonTitle, cards };
}

export function shouldUseMockAI(): boolean {
  return (
    process.env.AI_MOCK === "1" ||
    process.env.E2E === "1" ||
    process.env.PLAYWRIGHT_TEST === "1" ||
    process.env.NODE_ENV === "test"
  );
}

