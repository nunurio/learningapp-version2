import { Agent } from "@openai/agents";
import { runner } from "@/lib/ai/agents/index";
import { CoursePlanSchema } from "@/lib/ai/schema";
import type { CoursePlan } from "@/lib/types";

export const OutlineAgent = new Agent({
  name: "Course Planner",
  instructions: [
    "あなたは教育設計の専門家です。",
    "出力はoutputTypeのスキーマに厳格に従い、日本語で簡潔に。",
  ].join("\n"),
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
  const parsed = CoursePlanSchema.safeParse(JSON.parse(text));
  if (!parsed.success) throw new Error("CoursePlan schema mismatch");
  return parsed.data as CoursePlan;
}
