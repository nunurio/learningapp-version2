import { NextResponse } from "next/server";
import { initAgents } from "@/lib/ai/agents/index";
import { runLessonCardsAgent } from "@/lib/ai/agents/lesson-cards";
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
  let desiredCardType: "text" | "quiz" | "fill-blank" | undefined;
  let userBrief: string | undefined;
  try {
    if (req.headers.get("content-type")?.includes("application/json")) {
      const j = (await req.json().catch(() => ({}))) as Partial<{
        lessonTitle: string;
        desiredCount: number;
        courseId: UUID;
        course: { title: string; description?: string | null; category?: string | null };
        desiredCardType: "text" | "quiz" | "fill-blank";
        userBrief: string;
      }>;
      lessonTitle = j.lessonTitle ?? undefined;
      desiredCount = typeof j.desiredCount === "number" ? j.desiredCount : undefined;
      courseId = j.courseId ?? undefined;
      course = j.course ?? undefined;
      if (j.desiredCardType === "text" || j.desiredCardType === "quiz" || j.desiredCardType === "fill-blank") {
        desiredCardType = j.desiredCardType;
      }
      if (typeof j.userBrief === "string" && j.userBrief.trim().length > 0) {
        userBrief = j.userBrief.trim();
      }
    }
  } catch {}
  try {
    const url = new URL(req.url);
    lessonTitle = lessonTitle ?? url.searchParams.get("lessonTitle") ?? undefined;
    const dc = url.searchParams.get("desiredCount");
    if (dc != null) desiredCount = Number(dc);
    const cid = url.searchParams.get("courseId");
    if (cid) courseId = cid as UUID;
    const t = url.searchParams.get("desiredCardType");
    if (t === "text" || t === "quiz" || t === "fill-blank") desiredCardType = t;
    const ub = url.searchParams.get("userBrief");
    if (ub && ub.trim()) userBrief = ub.trim();
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

  const updates: AiUpdate[] = [];
  const start = Date.now();
  updates.push({ ts: start, text: "received" });
  try {
    initAgents();
    // 単体生成: desiredCount <= 1 を専用エージェントに分岐
    const isSingle = typeof desiredCount === "number" ? desiredCount <= 1 : true;
    const payload = isSingle
      ? await (await import("@/lib/ai/agents/lesson-cards")).runSingleCardAgent({ lessonTitle, course, desiredCardType, userBrief })
      : await runLessonCardsAgent({ lessonTitle, desiredCount, course });
    updates.push({ ts: Date.now(), text: "runAgent" }, { ts: Date.now(), text: "persistPreview" });
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
