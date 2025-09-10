import type { CoursePlan, LessonCards, CardType } from "@/lib/types";

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

export function createCoursePlanMock(input: {
  theme: string;
  level?: string;
  goal?: string;
  lessonCount?: number;
  userBrief?: string;
}): CoursePlan {
  const count = Math.max(3, Math.min(typeof input.lessonCount === "number" ? input.lessonCount : 12, 30));
  const level = (input.level ?? "").trim() || "初心者";
  const goal = (input.goal ?? "").trim() || "中級者";
  const lessons = Array.from({ length: count }).map((_, i) => ({
    title: `${input.theme} 基礎 ${i + 1}`,
    summary: `このレッスンでは「${input.theme}」の基礎トピック${i + 1}を学びます。`,
  }));
  return {
    course: {
      title: `${input.theme} 入門コース` + (level ? `（前提: ${level}）` : ""),
      description: [
        `目標: ${goal}`,
        `想定: 1レッスンあたり約60分`,
        input.userBrief && input.userBrief.trim() ? `要望: ${input.userBrief.trim()}` : null,
      ].filter(Boolean).join("\n") || null,
      category: null,
      level,
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

// 計画フェーズのモック
export function createLessonCardsPlanMock(input: {
  lessonTitle: string;
  desiredCount?: number;
  course?: { title: string; description?: string | null; category?: string | null; level?: string | null };
  lessons?: { title: string }[];
  index?: number;
}) {
  const dc = typeof input.desiredCount === "number" ? input.desiredCount : undefined;
  // 簡易ヒューリスティック: レッスン前後関係とタイトル長で 4〜10 枚に分布
  const base = input.lessons && input.lessons.length ? 4 + ((input.index ?? 0) % 4) : 6;
  const bias = Math.min(2, Math.max(0, Math.round((input.lessonTitle?.length ?? 6) / 12)));
  const target = typeof dc === "number" ? dc : base + bias;
  const count = Math.max(3, Math.min(target, 20));
  const seq = Array.from({ length: count }).map((_, i) => i);
  const types: CardType[] = seq.map((i) => (i % 3 === 0 ? "text" : i % 3 === 1 ? "quiz" : "fill-blank"));
  const cards = seq.map((i) => ({
    type: types[i],
    brief: `${input.lessonTitle} の要点 ${i + 1} を扱う` + (types[i] === "quiz" ? "（概念理解を確認）" : types[i] === "fill-blank" ? "（重要語を穴埋め）" : ""),
    title: null,
  }));
  const level = input.course?.level ?? "初心者";
  const sharedPrefix = [
    `Course: ${input.course?.title ?? ""}`,
    input.course?.description ?? "",
    `学習者レベル: ${level}`,
    input.lessons && input.lessons.length ? `Lessons: ${input.lessons.map((l) => l.title).join(" / ")}` : "",
    `Lesson: ${input.lessonTitle}`,
    `到達目標: レッスン完了時に ${input.lessonTitle} の重要概念を説明し、簡単なタスクを自力で実施できる`,
    `前提: コース前提の基礎知識（環境/基本用語）`,
    `用語集: 主要用語を簡潔に定義（例: キーワード, 基本操作, 代表API）`,
  ].filter(Boolean).join("\n");
  return { lessonTitle: input.lessonTitle, count, cards, sharedPrefix };
}

export function shouldUseMockAI(): boolean {
  return (
    process.env.AI_MOCK === "1" ||
    process.env.E2E === "1" ||
    process.env.PLAYWRIGHT_TEST === "1"
  );
}
