import { Agent } from "@openai/agents";
import type { UnknownContext } from "@openai/agents";
import { runner } from "@/lib/ai/agents/index";
import { lessonCardsGuardrail } from "@/lib/ai/agents/guardrails";
import type { OutputGuardrail } from "@openai/agents";
import { LessonCardsSchema, SingleLessonCardsSchema } from "@/lib/ai/schema";
import type { LessonCards, CardType } from "@/lib/types";
import { extractAgentJSON, parseWithSchema } from "@/lib/ai/executor";

// 単体カード専用エージェント（1件ぴったり）
export const SingleCardAgent = new Agent<UnknownContext, typeof SingleLessonCardsSchema>({
  name: "Single Card Writer",
  instructions: [
    "あなたは教育コンテンツ作成の専門家です。",
    "text / quiz / fill-blank から適切な形式を1件だけ生成。",
    "fill-blankは[[n]]とanswersの整合を厳守。",
  ].join("\n"),
  outputType: SingleLessonCardsSchema,
  outputGuardrails: [lessonCardsGuardrail as unknown as OutputGuardrail<typeof SingleLessonCardsSchema>],
  model: process.env.OPENAI_MODEL,
});

export async function runSingleCardAgent(input: {
  lessonTitle: string;
  course?: { title: string; description?: string | null; category?: string | null; level?: string | null };
  desiredCardType?: CardType;
  userBrief?: string;
  // prompt caching を狙う共通プレフィックス（全カードで同一）
  sharedPrefix?: string;
}): Promise<LessonCards> {
  const count = 1;
  const hints: string[] = [
    input.sharedPrefix ? String(input.sharedPrefix) : "",
    `次のレッスン用にカードを${count}件だけ生成してください。`,
  ].filter(Boolean);
  if (input.desiredCardType) hints.push(`カードタイプは "${input.desiredCardType}" を必ず使用。`);
  if (input.userBrief && input.userBrief.trim()) hints.push(`ユーザー要望: ${input.userBrief.trim()}`);
  const level = input.course?.level ?? "初心者";
  hints.push(`学習者レベル: ${level} を想定。説明の深さ・用語の難易度・例の具体性をこのレベルに最適化してください。`);
  // 型に合わせるために最小限の日本語指示を追加
  hints.push("入力は JSON: { lessonTitle, desiredCount, course?, desiredCardType?, userBrief? }。course は { title, description?, category? }。");
  hints.push("title は任意。未使用フィールドは null。type は text|quiz|fill-blank のいずれか。");
  hints.push("text の場合は約5分で読み切れる密度（700〜1200字目安）で、そのレッスンの知識を過不足なくインプットできるように。");
  const sys = hints.join("\n");
  const res = await runner.run(
    SingleCardAgent,
    `${sys}\n${JSON.stringify({ lessonTitle: input.lessonTitle, desiredCount: count, course: input.course, desiredCardType: input.desiredCardType, userBrief: input.userBrief })}`,
    { maxTurns: 1 }
  );
  const result = extractAgentJSON(res);
  if (!result) throw new Error("No agent output");
  const parsed = parseWithSchema(SingleLessonCardsSchema, result);
  if (input.desiredCardType) {
    const produced = parsed.cards[0]?.type;
    if (produced !== input.desiredCardType) {
      throw new Error(`type mismatch: expected ${input.desiredCardType}, got ${produced}`);
    }
  }
  // 返却型はLessonCards互換
  return parsed as unknown as LessonCards;
}
