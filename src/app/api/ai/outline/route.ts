import { NextResponse } from "next/server";
import { initAgents } from "@/lib/ai/agents/index";
import { runOutlineAgent } from "@/lib/ai/agents/outline";
import { createCoursePlanMock, shouldUseMockAI } from "@/lib/ai/mock";
import type { CoursePlan } from "@/lib/types";
import type { AiUpdate } from "@/lib/ai/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ストリーミング(SSE)は廃止し、最終結果のみJSONで返す
export async function POST(req: Request) {
  let theme: string | undefined;
  let level: string | undefined;
  let goal: string | undefined;
  let lessonCount: number | undefined;

  try {
    if (req.headers.get("content-type")?.includes("application/json")) {
      const j = (await req.json().catch(() => ({}))) as Partial<{
        theme: string;
        level: string;
        goal: string;
        lessonCount: number;
      }>;
      theme = j.theme ?? undefined;
      level = j.level ?? undefined;
      goal = j.goal ?? undefined;
      lessonCount = typeof j.lessonCount === "number" ? j.lessonCount : undefined;
    }
  } catch {}
  try {
    const url = new URL(req.url);
    theme = theme ?? url.searchParams.get("theme") ?? undefined;
    level = level ?? url.searchParams.get("level") ?? undefined;
    goal = goal ?? url.searchParams.get("goal") ?? undefined;
    const lc = url.searchParams.get("lessonCount");
    if (lc != null) lessonCount = Number(lc);
  } catch {}
  if (!theme || typeof theme !== "string") theme = "コース";

  try {
    const start = Date.now();
    const useMock = shouldUseMockAI() || !process.env.OPENAI_API_KEY;
    const plan = useMock
      ? createCoursePlanMock({ theme, level, goal, lessonCount })
      : (initAgents(), await runOutlineAgent({ theme, level, goal, lessonCount }));
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
