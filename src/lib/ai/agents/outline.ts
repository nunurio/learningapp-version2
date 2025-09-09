import { Agent } from "@openai/agents";
import type { UnknownContext } from "@openai/agents";
import { runner } from "@/lib/ai/agents/index";
import { CoursePlanSchema } from "@/lib/ai/schema";
import type { CoursePlan } from "@/lib/types";

export const OutlineAgent = new Agent<UnknownContext, typeof CoursePlanSchema>({
  name: "Course Planner",
  instructions: [
    "あなたは教育設計の専門家です。",
  ].join("\n"),
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
}): Promise<CoursePlan> {
  const lc = typeof input.lessonCount === "number" ? input.lessonCount : 6;
  const count = Math.max(3, Math.min(lc, 30));
  const sys = `次の条件でコース案（レッスン${count}件）を作成してください。`;
  const res = await runner.run(
    OutlineAgent,
    `${sys}\n${JSON.stringify({ ...input, lessonCount: count })}`,
    { maxTurns: 1 }
  );
  // 1) 構造化出力（推奨） 2) 文字列(JSON) 3) 最後のテキスト で後方互換的に解釈
  const result = (() => {
    const r: unknown = res;
    if (r && typeof r === "object") {
      const rec = r as Record<string, unknown>;
      const a = rec.finalOutput as unknown;
      const b = rec.finalText as unknown;
      // structured output already parsed
      if (a && typeof a === "object") return a;
      // sometimes SDK may still return string JSON
      if (typeof a === "string") {
        try { return JSON.parse(a) as unknown; } catch {}
      }
      if (typeof b === "string") {
        try { return JSON.parse(b) as unknown; } catch {}
      }
    }
    return undefined;
  })();
  if (!result) throw new Error("No agent output");
  const parsed = CoursePlanSchema.safeParse(result);
  if (!parsed.success) throw new Error("CoursePlan schema mismatch");
  return parsed.data as CoursePlan;
}
