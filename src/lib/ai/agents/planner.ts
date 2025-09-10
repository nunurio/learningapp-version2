import { Agent } from "@openai/agents";
import type { UnknownContext } from "@openai/agents";
import { runner } from "@/lib/ai/agents/index";
import { LessonCardsPlanSchema, type LessonCardsPlan } from "@/lib/ai/schema";
import { extractAgentJSON, parseWithSchema } from "@/lib/ai/executor";
import { z } from "zod";

// レッスン一式のカード計画（順番・タイプ・ブリーフ）を作るエージェント
export const CardsPlannerAgent = new Agent<UnknownContext, typeof LessonCardsPlanSchema>({
  name: "Lesson Cards Planner",
  instructions: [
    "あなたは教育コンテンツ設計の専門家です。",
    "目的: 今回は ‘アウトラインのみ’ を設計します。各カードのタイプと狙い（1〜2文の要約）だけを決め、詳細（問題文・選択肢・空所[[n]]・正解・数式・コード・API名の列挙 等）は書かないでください。",
    "各カードには type(text|quiz|fill-blank) と brief（概要の1行/50〜120字程度）、任意 title を指定します。brief は学習意図と扱う話題を短く要約し、具体的指示や箇条書きは禁止です（例: ‘選択肢…/正解…/[[1]]…/A) …’ を書かない）。",
    "text/quiz/fill-blank は学習効果が最大になるよう多様に配列し、導入→概念→確認→まとめの流れを意識してください。",
    "count は cards.length と必ず一致させてください。",
    "sharedPrefix は必須です。以下を“高レベルの要約”として簡潔に含めます: 1) 到達目標、2) 前提（Prerequisites）、3) 簡潔な用語集（箇条書き可・定義は一行）、4) 学習者レベル（例: 入門/初級/中級/上級）。詳細な式や選択肢は含めません。",
    "学習者レベルは context.course.level が未指定なら『初心者』と明記してください（推定しない）。",
    "出力は構造化スキーマ LessonCardsPlan に厳密準拠。brief は概要のみで、詳細生成は後段の ‘Writer’ が担当します。",
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
    `今回のレッスンに最適な ‘カード計画(アウトライン)’ を 3〜20 枚の範囲で決定してください（desiredCount は目安。必要に応じて調整可）。`,
    `cards は生成順で並べ、各 item に type と brief（概要の1行/50〜120字）と任意 title を含めます。brief は詳細指示を書かず、後続の生成器が解釈できる最小限の狙いに留めます。`,
    `禁止: 問題文そのもの・選択肢や正解の明記・[[n]] の空所指定・具体的な数式/コード/API名の列挙・文字数指定（例: 700〜1200字）。`,
    `count は cards.length と一致させ、導入→概念→確認→まとめの流れを意識してください。`,
    `sharedPrefix は到達目標/前提/簡潔な用語集/学習者レベルを高レベルで記述します（詳細は書かない）。`,
    `学習者レベルは context.course.level が未指定なら『初心者』としてください（推定しない）。`,
    `出力は LessonCardsPlan スキーマに厳密準拠。`,
  ].join("\n");
  const res = await runner.run(
    CardsPlannerAgent,
    `${sys}\n${JSON.stringify(input)}`,
    { maxTurns: 1 }
  );
  const result = extractAgentJSON(res);
  if (!result) throw new Error("No planner output");
  // 軽いサニタイズ: brief を概要レベルに強制（安全側のトリム）
  const LoosePlanSchema = z.object({
    cards: z.array(z.unknown()).optional(),
  });
  const sanitized = (() => {
    if (typeof result !== "object" || result === null) return result;
    const parsed = LoosePlanSchema.safeParse(result);
    if (!parsed.success || !Array.isArray(parsed.data.cards)) return result;
    const hasBrief = (o: unknown): o is { brief: string } =>
      typeof o === "object" && o !== null && typeof (o as { brief?: unknown }).brief === "string";
    const newCards = parsed.data.cards.map((c) => {
      if (!hasBrief(c)) return c;
      let s = c.brief.replace(/\[\[(\d+)\]\]/g, "").replace(/選択肢|正解/g, "").replace(/\b[A-E]\)\s*/g, "");
      if (s.length > 140) s = s.slice(0, 140);
      return { ...(c as Record<string, unknown>), brief: s.trim() };
    });
    return { ...(result as Record<string, unknown>), cards: newCards };
  })();
  return parseWithSchema(LessonCardsPlanSchema, sanitized) as LessonCardsPlan;
}
