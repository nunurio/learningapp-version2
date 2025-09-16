import { Agent, user, type AgentInputItem } from "@openai/agents";
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
  // モデルは runner 側の既定を使用
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
  // 入力は Items 化（user）して渡す
  const ctx = input.context;
  const items: AgentInputItem[] = [
    user(
      [
        "レッスン用のカード計画を作成してください。",
        `レッスン: ${input.lessonTitle}`,
        `カード目安数: ${typeof input.desiredCount === "number" ? input.desiredCount : "(未指定)"}`,
        "コース文脈:",
        `  タイトル: ${ctx.course.title}`,
        `  説明: ${ctx.course.description ?? "(なし)"}`,
        `  カテゴリ: ${ctx.course.category ?? "(なし)"}`,
        `  レベル: ${ctx.course.level ?? "(未指定)"}`,
        `レッスン一覧(${ctx.lessons.length}件): ${ctx.lessons.map((l) => l.title).join(" | ")}`,
        `このレッスンのインデックス: ${ctx.index}`,
      ].join("\n")
    ),
  ];
  const res = await runner.run(CardsPlannerAgent, items, { maxTurns: 1 });
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
