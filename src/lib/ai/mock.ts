"use client";

import type { CoursePlan, LessonCards } from "../types";

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateCoursePlan(params: {
  theme: string;
  level?: string;
  goal?: string;
  lessonCount?: number;
}): CoursePlan {
  const count = Math.min(Math.max(params.lessonCount ?? 6, 3), 30);
  const courseTitle = `${params.theme.trim()} 入門${params.level ? `（${params.level}）` : ""}`;
  const descriptions = [
    "基礎から実践まで短期間で学べるコース",
    "最小限の理論と豊富な練習問題で身につける",
    "プロジェクト型で体系的に理解する",
  ];
  const plan: CoursePlan = {
    course: {
      title: courseTitle,
      description: params.goal
        ? `${params.goal} を達成するためのコース`
        : pick(descriptions),
      category: "General",
    },
    lessons: Array.from({ length: count }, (_, i) => ({
      title: `${params.theme.trim()} 第${i + 1}回: 基礎トピック ${i + 1}`,
      summary: `コア概念とサンプルで ${params.theme.trim()} を理解する`,
    })),
  };
  return plan;
}

export function generateLessonCards(params: {
  lessonTitle: string;
  desiredCount?: number;
}): LessonCards {
  const count = Math.min(Math.max(params.desiredCount ?? 5, 3), 20);
  const cards: LessonCards["cards"] = [];
  for (let i = 0; i < count; i++) {
    if (i % 3 === 0) {
      cards.push({
        type: "text",
        title: `解説 ${i + 1}`,
        body: `${params.lessonTitle} のポイント ${i + 1} を解説します。`,
      });
    } else if (i % 3 === 1) {
      cards.push({
        type: "quiz",
        title: `クイズ ${i + 1}`,
        question: `${params.lessonTitle} に関する基本問題 ${i + 1}`,
        options: ["A", "B", "C", "D"],
        answerIndex: Math.floor(Math.random() * 4),
        explanation: "正解の理由を簡潔に説明。",
      });
    } else {
      cards.push({
        type: "fill-blank",
        title: `穴埋め ${i + 1}`,
        text: `${params.lessonTitle} のキーワードは [[1]] です。`,
        answers: { "1": "キーワード" },
        caseSensitive: false,
      });
    }
  }
  return { lessonTitle: params.lessonTitle, cards };
}
