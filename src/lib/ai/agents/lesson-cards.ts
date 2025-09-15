import { Agent, user } from "@openai/agents";
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
    // モデルは runner 既定を使用
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
  const agent = createSingleCardAgent(input.desiredCardType as unknown as CardKind);
  // 入力は Items 化（user）して渡す
  const items: unknown[] = [
    user(
      [
        "このレッスンに対して、指定があればそのタイプでカードを1件だけ作成してください。",
        `レッスン: ${input.lessonTitle}`,
        `カードタイプ: ${input.desiredCardType ?? "(未指定)"}`,
        `ユーザーブリーフ: ${(input.userBrief ?? "").trim() || "(なし)"}`,
        `共有プレフィックス: ${input.sharedPrefix ?? "(なし)"}`,
        "コース情報:",
        `  タイトル: ${input.course?.title ?? "(不明)"}`,
        `  説明: ${input.course?.description ?? "(なし)"}`,
        `  カテゴリ: ${input.course?.category ?? "(なし)"}`,
        `  レベル: ${input.course?.level ?? "(未指定)"}`,
      ].join("\n")
    ),
  ];
  const res = await runner.run(agent, items, { maxTurns: 1 });
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
