import { NextResponse } from "next/server";
import { initAgents } from "@/lib/ai/agents/index";
import { runOutlineAgent } from "@/lib/ai/agents/outline";
import { createCoursePlanMock, shouldUseMockAI } from "@/lib/ai/mock";
import type { CoursePlan } from "@/lib/types";
import type { AiUpdate } from "@/lib/ai/log";
import { z } from "zod";
import { parseJsonWithQuery } from "@/lib/utils/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ストリーミング(SSE)は廃止し、最終結果のみJSONで返す
export async function POST(req: Request) {
  const RequestSchema = z.object({
    theme: z.string().min(1),
    level: z.string().optional(),
    goal: z.string().optional(),
    lessonCount: z.number().int().optional(),
    userBrief: z.string().optional(),
  });
  const input = await parseJsonWithQuery(req, RequestSchema, { theme: "コース" });
  const { theme, level, goal, lessonCount, userBrief } = input;

  try {
    const start = Date.now();
    const useMock = shouldUseMockAI();
    const plan = useMock
      ? createCoursePlanMock({ theme, level, goal, lessonCount, userBrief })
      : (initAgents(), await runOutlineAgent({ theme, level, goal, lessonCount, userBrief }));
    const updates: AiUpdate[] = [
      { ts: start, text: "received" },
      { ts: Date.now(), text: useMock ? "mock" : "runAgent" },
      { ts: Date.now(), text: "persistPreview" },
    ];
    return NextResponse.json(
      { plan, updates },
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
