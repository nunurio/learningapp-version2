import { Agent } from "@openai/agents";
import type { UnknownContext } from "@openai/agents";
import { runner } from "@/lib/ai/agents/index";
import { lessonCardsGuardrail } from "@/lib/ai/agents/guardrails";
import type { OutputGuardrail } from "@openai/agents";
import { LessonCardsSchema, SingleLessonCardsSchema } from "@/lib/ai/schema";
import type { LessonCards, CardType } from "@/lib/types";

export const LessonCardsAgent = new Agent<UnknownContext, typeof LessonCardsSchema>({
  name: "Lesson Card Writer",
  instructions: [
    "あなたは教育コンテンツ作成の専門家です。",
    "text / quiz / fill-blank をバランス良く含め、fill-blankは[[n]]とanswers整合を厳守。",
  ].join("\n"),
  // 構造化出力: Zod スキーマで強制
  outputType: LessonCardsSchema,
  outputGuardrails: [lessonCardsGuardrail as unknown as OutputGuardrail<typeof LessonCardsSchema>],
  model: process.env.OPENAI_MODEL,
});

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

export async function runLessonCardsAgent(input: {
  lessonTitle: string;
  desiredCount?: number;
  course?: { title: string; description?: string | null; category?: string | null };
}): Promise<LessonCards> {
  const dc = typeof input.desiredCount === "number" ? input.desiredCount : 6;
  const count = Math.max(3, Math.min(dc, 20));
  const sys = `次のレッスン用にカードを${count}件、バランスよく生成してください。`;
  const res = await runner.run(
    LessonCardsAgent,
    `${sys}\n${JSON.stringify({ ...input, desiredCount: count })}`,
    { maxTurns: 1 }
  );
  // 1) 構造化出力（推奨） 2) 文字列(JSON) 3) 最後のテキスト で後方互換的に解釈
  const result = (() => {
    const r: unknown = res;
    if (r && typeof r === "object") {
      const rec = r as Record<string, unknown>;
      const a = rec.finalOutput as unknown;
      const b = rec.finalText as unknown;
      if (a && typeof a === "object") return a; // structured output
      if (typeof a === "string") { try { return JSON.parse(a) as unknown; } catch {} }
      if (typeof b === "string") { try { return JSON.parse(b) as unknown; } catch {} }
    }
    return undefined;
  })();
  if (!result) throw new Error("No agent output");
  const parsed = LessonCardsSchema.safeParse(result);
  if (!parsed.success) throw new Error("LessonCards schema mismatch");
  return parsed.data as LessonCards;
}

export async function runSingleCardAgent(input: {
  lessonTitle: string;
  course?: { title: string; description?: string | null; category?: string | null };
  desiredCardType?: CardType;
  userBrief?: string;
}): Promise<LessonCards> {
  const count = 1;
  const hints: string[] = [`次のレッスン用にカードを${count}件だけ生成してください。`];
  if (input.desiredCardType) hints.push(`カードタイプは "${input.desiredCardType}" を必ず使用。`);
  if (input.userBrief && input.userBrief.trim()) hints.push(`ユーザー要望: ${input.userBrief.trim()}`);
  // 型に合わせるために最小限の日本語指示を追加
  hints.push("title は任意。未使用フィールドは null で。type は text|quiz|fill-blank のいずれか。");
  const sys = hints.join("\n");
  const res = await runner.run(
    SingleCardAgent,
    `${sys}\n${JSON.stringify({ lessonTitle: input.lessonTitle, desiredCount: count, course: input.course, desiredCardType: input.desiredCardType, userBrief: input.userBrief })}`,
    { maxTurns: 1 }
  );
  const result = (() => {
    const r: unknown = res;
    if (r && typeof r === "object") {
      const rec = r as Record<string, unknown>;
      const a = rec.finalOutput as unknown;
      const b = rec.finalText as unknown;
      if (a && typeof a === "object") return a; // structured output
      if (typeof a === "string") { try { return JSON.parse(a) as unknown; } catch {} }
      if (typeof b === "string") { try { return JSON.parse(b) as unknown; } catch {} }
    }
    return undefined;
  })();
  if (!result) throw new Error("No agent output");
  const parsed = SingleLessonCardsSchema.safeParse(result);
  if (!parsed.success) throw new Error("SingleLessonCards schema mismatch");
  // 返却型はLessonCards互換
  return parsed.data as unknown as LessonCards;
}
