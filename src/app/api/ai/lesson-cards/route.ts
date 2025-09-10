import { NextResponse } from "next/server";
import { initAgents } from "@/lib/ai/agents/index";
// 旧: 一括生成ロジックは廃止。単体生成のみを扱う。
import { createLessonCardsMock, shouldUseMockAI } from "@/lib/ai/mock";
import { getCourse } from "@/lib/db/queries";
import type { UUID } from "@/lib/types";
import type { LessonCards } from "@/lib/types";
import type { AiUpdate } from "@/lib/ai/log";
import { z } from "zod";
import { parseJsonWithQuery } from "@/lib/utils/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ストリーミング(SSE)は廃止し、最終結果のみJSONで返す
export async function POST(req: Request) {
  const RequestSchema = z.object({
    lessonTitle: z.string().min(1),
    desiredCount: z.number().int().optional(),
    courseId: z.string().optional(),
    course: z
      .object({
        title: z.string(),
        description: z.string().nullable().optional(),
        category: z.string().nullable().optional(),
        level: z.string().nullable().optional(),
      })
      .optional(),
    desiredCardType: z.enum(["text", "quiz", "fill-blank"]).optional(),
    userBrief: z.string().optional(),
    sharedPrefix: z.string().optional(),
  });
  const input = await parseJsonWithQuery(req, RequestSchema, { lessonTitle: "レッスン" });
  let { lessonTitle, desiredCount, courseId, course, desiredCardType, userBrief, sharedPrefix } = input;

  // server 側で courseId があればコース情報を解決
  try {
    if (!course && courseId) {
      const co = await getCourse(courseId);
      if (co) {
        course = { title: co.title, description: co.description ?? null, category: co.category ?? null, level: (co as { level?: string | null }).level ?? "初心者" };
      }
    }
  } catch {
    // course 解決失敗は致命ではない（プロンプト強化なしで続行）
  }

  const updates: AiUpdate[] = [];
  const start = Date.now();
  updates.push({ ts: start, text: "received" });
  try {
    const useMock = shouldUseMockAI();
    // 単体生成のみ許可（旧一括生成はサポート外）
    const isSingle = typeof desiredCount === "number" ? desiredCount <= 1 : true;
    if (!isSingle) {
      return NextResponse.json(
        { error: "Batch generation is no longer supported. Use /api/ai/lesson-cards/plan and single-card generation in parallel." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    const payload = useMock
      ? createLessonCardsMock({ lessonTitle, desiredCount: 1, desiredCardType, userBrief })
      : (initAgents(), await (await import("@/lib/ai/agents/lesson-cards")).runSingleCardAgent({ lessonTitle, course, desiredCardType, userBrief, ...(sharedPrefix ? { sharedPrefix } : {}) }));
    updates.push({ ts: Date.now(), text: useMock ? "mock" : "runAgent" }, { ts: Date.now(), text: "persistPreview" });
    return NextResponse.json(
      { payload, updates },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : typeof e === "string" ? e : "unknown";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
