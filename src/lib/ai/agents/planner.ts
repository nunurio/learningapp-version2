import { Agent } from "@openai/agents";
import type { UnknownContext } from "@openai/agents";
import { runner } from "@/lib/ai/agents/index";
import { LessonCardsPlanSchema, type LessonCardsPlan } from "@/lib/ai/schema";
import { parseWithSchema, fallbackFromHistory } from "@/lib/ai/executor";
import { z } from "zod";
import { CARDS_PLANNER_INSTRUCTIONS } from "@/lib/ai/prompts";

// レッスン一式のカード計画（順番・タイプ・ブリーフ）を作るエージェント
export const CardsPlannerAgent = new Agent<UnknownContext, typeof LessonCardsPlanSchema>({
  name: "Lesson Cards Planner",
  instructions: CARDS_PLANNER_INSTRUCTIONS,
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
  const payload = {
    task: "Plan lesson cards strictly as LessonCardsPlan JSON.",
    parameters: {
      lessonTitle: input.lessonTitle,
      desiredCount: typeof input.desiredCount === "number" ? input.desiredCount : null,
      context: input.context,
    },
  } as const;
  const res = await runner.run(CardsPlannerAgent, JSON.stringify(payload), { maxTurns: 1 });
  // まず finalOutput を信頼（Zod 検証済み）
  const result = res.finalOutput as unknown;
  if (!result) {
    const fb = fallbackFromHistory(res, LessonCardsPlanSchema);
    if (fb) return fb as LessonCardsPlan;
    throw new Error("No planner output");
  }
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
