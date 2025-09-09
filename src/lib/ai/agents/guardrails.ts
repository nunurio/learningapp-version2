import type { OutputGuardrail } from "@openai/agents";
import { type z } from "zod";
import { LessonCardsSchema, SingleLessonCardsSchema } from "@/lib/ai/schema";

export const lessonCardsGuardrail: OutputGuardrail = {
  name: "LessonCards integrity",
  async execute({ agentOutput }) {
    // Validate and narrow output using Zod to keep member access type-safe
    // Accept either batch (>=3) or single (1) schema
    const single = SingleLessonCardsSchema.safeParse(agentOutput as unknown);
    const batch = single.success ? null : LessonCardsSchema.safeParse(agentOutput as unknown);
    if (!single.success && !batch?.success) {
      return { tripwireTriggered: true, outputInfo: { reason: "schema mismatch" } };
    }
    const p = single.success ? single.data : (batch && batch.success ? batch.data : undefined);
    if (!p) {
      return { tripwireTriggered: true, outputInfo: { reason: "schema mismatch" } };
    }
    for (const c of p.cards) {
      if (c.type === "quiz") {
        if (!Array.isArray(c.options) || typeof c.answerIndex !== "number") {
          return { tripwireTriggered: true, outputInfo: { reason: "quiz fields missing" } };
        }
        if (!(c.answerIndex >= 0 && c.answerIndex < c.options.length)) {
          return { tripwireTriggered: true, outputInfo: { reason: "quiz.answerIndex out of range" } };
        }
      }
      if (c.type === "fill-blank") {
        if (typeof c.text !== "string" || !c.answers) {
          return { tripwireTriggered: true, outputInfo: { reason: "fill-blank fields missing" } };
        }
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
