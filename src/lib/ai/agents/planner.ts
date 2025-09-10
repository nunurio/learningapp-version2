import { Agent } from "@openai/agents";
import type { UnknownContext } from "@openai/agents";
import { runner } from "@/lib/ai/agents/index";
import { LessonCardsPlanSchema, type LessonCardsPlan } from "@/lib/ai/schema";

// レッスン一式のカード計画（順番・タイプ・ブリーフ）を作るエージェント
export const CardsPlannerAgent = new Agent<UnknownContext, typeof LessonCardsPlanSchema>({
  name: "Lesson Cards Planner",
  instructions: [
    "あなたは教育コンテンツ設計の専門家です。",
    "与えられたコース/レッスン情報とレッスン一覧（前後関係）を踏まえ、今回のレッスンに最適なカード列を設計してください。",
    "出力では各カードの type(text|quiz|fill-blank) と、作成時に参照する brief（短い要件）を定義します。",
    "text/quiz/fill-blank は学習効果が最大になるよう多様に配列してください。",
    "count は cards.length と必ず一致させてください。",
    "sharedPrefix は必須です。以下を簡潔に含めてください: 1) このレッスンの到達目標、2) 受講者の前提（Prerequisites）、3) 用語集（Glossary）として重要語の箇条書き、4) 学習者レベル（例: 入門/初級/中級/上級）。",
    "学習者レベルは context.course.level が未指定なら『初心者』と明記してください（推定しない）。",
  ].join("\n"),
  outputType: LessonCardsPlanSchema,
  model: process.env.OPENAI_MODEL,
});

export async function runCardsPlanner(input: {
  lessonTitle: string;
  desiredCount?: number; // ユーザーが目安を指定した場合
  context: {
    course: { title: string; description?: string | null; category?: string | null; level?: string | null };
    lessons: { title: string }[]; // 同一コースのレッスン一覧（順番）
    index: number; // 現レッスンのインデックス
  };
}): Promise<LessonCardsPlan> {
  const sys = [
    `あなたには JSON 入力が与えられます: { lessonTitle, desiredCount?, context: { course: { title, description?, category?, level? }, lessons: { title }[], index } }。`,
    `今回のレッスンに最適なカード計画を 3〜20 枚の範囲で自ら決定してください（desiredCount は目安。必要に応じて調整可）。`,
    `cards は最終生成順に並べ、各 item に type(text|quiz|fill-blank) と brief（作成時の具体的要件）と任意 title を含めてください。`,
    `text は1枚で約5分で読み切れる密度（700〜1200字目安）で要点を網羅できるように設計すること。`,
    `quiz は 4〜5 選択肢を想定し概念理解を確認、fill-blank は [[n]] 形式で重要語の想起を促すように。`,
    `count は cards.length と必ず一致させること。重複は不可。学習の導入→概念→確認→まとめの流れを意識。`,
    `sharedPrefix は必須で、到達目標/前提/用語集/学習者レベルを含めること（カード生成で毎回使い回します）。`,
    `学習者レベルは context.course.level が未指定なら『初心者』としてください（推定しない）。`,
    `出力は構造化スキーマ LessonCardsPlan に厳密準拠。`,
  ].join("\n");
  const res = await runner.run(
    CardsPlannerAgent,
    `${sys}\n${JSON.stringify(input)}`,
    { maxTurns: 1 }
  );
  const result = (() => {
    const r: unknown = res;
    if (r && typeof r === "object") {
      const rec = r as Record<string, unknown>;
      const a = rec.finalOutput as unknown;
      const b = rec.finalText as unknown;
      if (a && typeof a === "object") return a;
      if (typeof a === "string") { try { return JSON.parse(a) as unknown; } catch {} }
      if (typeof b === "string") { try { return JSON.parse(b) as unknown; } catch {} }
    }
    return undefined;
  })();
  if (!result) throw new Error("No planner output");
  const parsed = LessonCardsPlanSchema.safeParse(result);
  if (!parsed.success) throw new Error("LessonCardsPlan schema mismatch");
  return parsed.data as LessonCardsPlan;
}
