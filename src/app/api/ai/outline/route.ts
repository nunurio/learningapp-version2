import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { generateCoursePlan } from "@/lib/ai/mock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ストリーミング(SSE)は廃止し、最終結果のみJSONで返す
export async function POST(req: NextRequest) {
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
    const plan = generateCoursePlan({ theme, level, goal, lessonCount });
    return NextResponse.json(
      { plan },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e: unknown) {
    const err = e as { message?: string } | undefined;
    return new NextResponse(
      JSON.stringify({ error: err?.message ?? "unknown" }),
      { status: 500, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } },
    );
  }
}
