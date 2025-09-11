import { Agent } from "@openai/agents";
import type { UnknownContext } from "@openai/agents";
import { runner } from "@/lib/ai/agents/index";
import { lessonCardsGuardrail } from "@/lib/ai/agents/guardrails";
import type { OutputGuardrail } from "@openai/agents";
import { LessonCardsSchema, SingleLessonCardsSchema } from "@/lib/ai/schema";
import type { LessonCards, CardType } from "@/lib/types";
import { fallbackFromHistory } from "@/lib/ai/executor";
import { buildSingleCardWriterInstructions, type CardKind } from "@/lib/ai/prompts";
// outputType 指定により finalOutput は Zod 検証済み

// 単体カード専用エージェント（1件ぴったり）をタイプ別 instructions で都度生成
function createSingleCardAgent(kind?: CardKind) {
  return new Agent<UnknownContext, typeof SingleLessonCardsSchema>({
    name: "Single Card Writer",
    instructions: buildSingleCardWriterInstructions(kind),
    outputType: SingleLessonCardsSchema,
    outputGuardrails: [lessonCardsGuardrail as unknown as OutputGuardrail<typeof SingleLessonCardsSchema>],
    model: process.env.OPENAI_MODEL,
  });
}

export async function runSingleCardAgent(input: {
  lessonTitle: string;
  course?: { title: string; description?: string | null; category?: string | null; level?: string | null };
  desiredCardType?: CardType;
  userBrief?: string;
  // prompt caching を狙う共通プレフィックス（全カードで同一）
  sharedPrefix?: string;
}): Promise<LessonCards> {
  const payload = {
    task: "Write exactly 1 card as SingleLessonCards JSON.",
    parameters: {
      lessonTitle: input.lessonTitle,
      course: input.course ?? null,
      desiredCardType: input.desiredCardType ?? null,
      userBrief: (input.userBrief ?? "").trim() || null,
      sharedPrefix: input.sharedPrefix ?? null,
    },
  } as const;
  const agent = createSingleCardAgent(input.desiredCardType as unknown as CardKind);
  const res = await runner.run(agent, JSON.stringify(payload), { maxTurns: 1 });
  // まず finalOutput を信頼（Zod 検証済み）
  let parsed = res.finalOutput;
  if (!parsed) {
    const fb = fallbackFromHistory(res, SingleLessonCardsSchema);
    if (fb) parsed = fb;
  }
  if (!parsed) throw new Error("No agent output");
  if (input.desiredCardType) {
    const produced = parsed.cards[0]?.type;
    if (produced !== input.desiredCardType) {
      throw new Error(`type mismatch: expected ${input.desiredCardType}, got ${produced}`);
    }
  }
  // 返却型はLessonCards互換
  return parsed as unknown as LessonCards;
}
