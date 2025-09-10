import { Agent } from "@openai/agents";
import type { UnknownContext } from "@openai/agents";
import { runner } from "@/lib/ai/agents/index";
import { CoursePlanSchema } from "@/lib/ai/schema";
import type { CoursePlan } from "@/lib/types";
import { fallbackFromHistory } from "@/lib/ai/executor";
import { OUTLINE_AGENT_INSTRUCTIONS } from "@/lib/ai/prompts";
// finalOutput は outputType 指定時に Zod 検証済みで返る

export const OutlineAgent = new Agent<UnknownContext, typeof CoursePlanSchema>({
  name: "Course Planner",
  instructions: OUTLINE_AGENT_INSTRUCTIONS,
  // 構造化出力: Zod スキーマで強制
  outputType: CoursePlanSchema,
  model: process.env.OPENAI_MODEL,
  modelSettings: {
    maxTokens: process.env.OPENAI_MAX_OUTPUT_TOKENS
      ? Number(process.env.OPENAI_MAX_OUTPUT_TOKENS)
      : undefined,
  },
});

export async function runOutlineAgent(input: {
  theme: string;
  level?: string;
  goal?: string;
  lessonCount?: number;
  userBrief?: string;
}): Promise<CoursePlan> {
  const lc = Math.max(3, Math.min(typeof input.lessonCount === "number" ? input.lessonCount : 12, 30));
  const payload = {
    task: "Design course outline strictly as CoursePlan JSON.",
    parameters: {
      theme: input.theme,
      level: input.level?.trim() || "初心者",
      goal: (input.goal ?? "").trim() || "中級者",
      lessonCount: lc,
      userBrief: (input.userBrief ?? "").trim() || null,
    },
  } as const;
  const res = await runner.run(OutlineAgent, JSON.stringify(payload), { maxTurns: 1 });
  // まず finalOutput を信頼（Zod 検証済み）
  if (res.finalOutput) return res.finalOutput as CoursePlan;
  // フォールバック: 履歴からテキスト抽出→JSON→Zod
  const fb = fallbackFromHistory(res, CoursePlanSchema);
  if (fb) return fb as CoursePlan;
  throw new Error("No agent output");
}
