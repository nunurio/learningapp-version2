import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { generateLessonCards } from "@/lib/ai/mock";
import type { LessonCards } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ストリーミング(SSE)は廃止し、最終結果のみJSONで返す
export async function POST(req: NextRequest) {
  // 入力の堅牢化: JSON/クエリどちらでも受け取り、未指定は安全にフォールバック
  let lessonTitle: string | undefined;
  let desiredCount: number | undefined;
  try {
    if (req.headers.get("content-type")?.includes("application/json")) {
      const j = (await req.json().catch(() => ({}))) as Partial<{ lessonTitle: string; desiredCount: number }>;
      lessonTitle = j.lessonTitle ?? undefined;
      desiredCount = typeof j.desiredCount === "number" ? j.desiredCount : undefined;
    }
  } catch {}
  try {
    const url = new URL(req.url);
    lessonTitle = lessonTitle ?? url.searchParams.get("lessonTitle") ?? undefined;
    const dc = url.searchParams.get("desiredCount");
    if (dc != null) desiredCount = Number(dc);
  } catch {}
  if (!lessonTitle || typeof lessonTitle !== "string") lessonTitle = "レッスン";

  try {
    const payload: LessonCards = generateLessonCards({ lessonTitle, desiredCount });
    return NextResponse.json(
      { payload },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e: unknown) {
    const err = e as { message?: string } | undefined;
    return new Response(
      JSON.stringify({ error: err?.message ?? "unknown" }),
      { status: 500, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } },
    );
  }
}
