import { NextResponse } from "next/server";
import { runLessonCardsGraph } from "@/lib/ai/langgraph/lesson-cards";
import { getCourse } from "@/lib/db/queries";
import type { UUID } from "@/lib/types";
import type { LessonCards } from "@/lib/types";
import type { AiUpdate } from "@/lib/ai/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ストリーミング(SSE)は廃止し、最終結果のみJSONで返す
export async function POST(req: Request) {
  // 入力の堅牢化: JSON/クエリどちらでも受け取り、未指定は安全にフォールバック
  let lessonTitle: string | undefined;
  let desiredCount: number | undefined;
  let courseId: UUID | undefined;
  let course: { title: string; description?: string | null; category?: string | null } | undefined;
  try {
    if (req.headers.get("content-type")?.includes("application/json")) {
      const j = (await req.json().catch(() => ({}))) as Partial<{
        lessonTitle: string;
        desiredCount: number;
        courseId: UUID;
        course: { title: string; description?: string | null; category?: string | null };
      }>;
      lessonTitle = j.lessonTitle ?? undefined;
      desiredCount = typeof j.desiredCount === "number" ? j.desiredCount : undefined;
      courseId = j.courseId ?? undefined;
      course = j.course ?? undefined;
    }
  } catch {}
  try {
    const url = new URL(req.url);
    lessonTitle = lessonTitle ?? url.searchParams.get("lessonTitle") ?? undefined;
    const dc = url.searchParams.get("desiredCount");
    if (dc != null) desiredCount = Number(dc);
    const cid = url.searchParams.get("courseId");
    if (cid) courseId = cid as UUID;
  } catch {}
  if (!lessonTitle || typeof lessonTitle !== "string") lessonTitle = "レッスン";

  // server 側で courseId があればコース情報を解決
  try {
    if (!course && courseId) {
      const co = await getCourse(courseId);
      if (co) {
        course = { title: co.title, description: co.description ?? null, category: co.category ?? null };
      }
    }
  } catch {
    // course 解決失敗は致命ではない（プロンプト強化なしで続行）
  }

  try {
    const result = await runLessonCardsGraph({ lessonTitle, desiredCount, course });
    const body: { payload: LessonCards; updates: AiUpdate[] } = {
      payload: result.payload,
      updates: result.updates,
    };
    return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : typeof e === "string" ? e : "unknown";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
