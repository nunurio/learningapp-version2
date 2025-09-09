import type { OutputGuardrail } from "@openai/agents";
import { type z } from "zod";
import { LessonCardsSchema } from "@/lib/ai/schema";

export const lessonCardsGuardrail: OutputGuardrail = {
  name: "LessonCards integrity",
  async execute({ agentOutput }) {
    // Validate and narrow output using Zod to keep member access type-safe
    const parsed = LessonCardsSchema.safeParse(agentOutput);
    if (!parsed.success) {
      return { tripwireTriggered: true, outputInfo: { reason: "schema mismatch" } };
    }
    const p = parsed.data;
    for (const c of p.cards) {
      if (c.type === "quiz") {
        if (!(c.answerIndex >= 0 && c.answerIndex < c.options.length)) {
          return { tripwireTriggered: true, outputInfo: { reason: "quiz.answerIndex out of range" } };
        }
      }
      if (c.type === "fill-blank") {
        const refs = new Set<string>();
        const re = /\[\[(\d+)\]\]/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(c.text)) != null) refs.add(m[1]);
        for (const r of refs) if (!(r in c.answers)) {
          return { tripwireTriggered: true, outputInfo: { reason: `fill-blank missing key: ${r}` } };
        }
      }
    }
    return { tripwireTriggered: false, outputInfo: {} };
  },
};
