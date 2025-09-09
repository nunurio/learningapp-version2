import { Agent } from "@openai/agents";
import { runner } from "@/lib/ai/agents/index";
import { lessonCardsGuardrail } from "@/lib/ai/agents/guardrails";
import { LessonCardsSchema } from "@/lib/ai/schema";
import type { LessonCards } from "@/lib/types";

export const LessonCardsAgent = new Agent({
  name: "Lesson Card Writer",
  instructions: [
    "あなたは教育コンテンツ作成の専門家です。",
    "text / quiz / fill-blank をバランス良く含め、fill-blankは[[n]]とanswers整合を厳守。",
    "出力はoutputTypeに厳格、日本語で簡潔。",
  ].join("\n"),
  outputGuardrails: [lessonCardsGuardrail],
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
  const text = (() => {
    const r: unknown = res;
    if (r && typeof r === "object") {
      const rec = r as Record<string, unknown>;
      const a = rec.finalOutput;
      const b = rec.finalText;
      if (typeof a === "string") return a;
      if (typeof b === "string") return b;
    }
    return undefined;
  })();
  if (!text) throw new Error("No agent output text");
  const parsed = LessonCardsSchema.safeParse(JSON.parse(text));
  if (!parsed.success) throw new Error("LessonCards schema mismatch");
  return parsed.data as LessonCards;
}
