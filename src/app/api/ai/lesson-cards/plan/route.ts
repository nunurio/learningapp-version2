import { NextResponse } from "next/server";
import { initAgents } from "@/lib/ai/agents/index";
import { runCardsPlanner } from "@/lib/ai/agents/planner";
import { createLessonCardsPlanMock, shouldUseMockAI } from "@/lib/ai/mock";
import { getCourse, listLessons } from "@/lib/db/queries";
import type { UUID } from "@/lib/types";
import type { AiUpdate } from "@/lib/ai/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let lessonTitle: string | undefined;
  let desiredCount: number | undefined;
  let courseId: UUID | undefined;
  try {
    if (req.headers.get("content-type")?.includes("application/json")) {
      const j = (await req.json().catch(() => ({}))) as Partial<{ lessonTitle: string; desiredCount: number; courseId: UUID }>;
      lessonTitle = j.lessonTitle ?? undefined;
      desiredCount = typeof j.desiredCount === "number" ? j.desiredCount : undefined;
      courseId = j.courseId ?? undefined;
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
  if (!lessonTitle) lessonTitle = "レッスン";

  const updates: AiUpdate[] = [];
  const start = Date.now();
  updates.push({ ts: start, text: "received" }, { ts: Date.now(), text: "planCards" });

  try {
    let planContext: { course?: { title: string; description?: string | null; category?: string | null; level?: string | null }; lessons: { title: string }[]; index: number } = { lessons: [], index: 0 };
    if (courseId) {
      try {
        const [course, lessons] = await Promise.all([getCourse(courseId), listLessons(courseId)]);
        const idx = lessons.findIndex((l) => l.title === lessonTitle);
        const lessonKey = (lessonTitle ?? "").toLowerCase();
        const level = (course as { level?: string | null } | undefined)?.level ?? "初心者";
        planContext = {
          course: course ? { title: course.title, description: course.description ?? null, category: course.category ?? null, level } : undefined,
          lessons: lessons.map((l) => ({ title: l.title })),
          index: idx >= 0 ? idx : Math.max(0, lessons.findIndex((l) => l.title.toLowerCase() === lessonKey)),
        };
      } catch {}
    }

    const useMock = shouldUseMockAI();
    const plan = useMock
      ? createLessonCardsPlanMock({ lessonTitle, desiredCount, course: planContext.course, lessons: planContext.lessons, index: planContext.index })
      : (initAgents(), await runCardsPlanner({ lessonTitle, desiredCount, context: { course: planContext.course ?? { title: lessonTitle }, lessons: planContext.lessons, index: planContext.index } }));
    updates.push({ ts: Date.now(), text: "planReady" });
    return NextResponse.json({ plan, updates }, { headers: { "Cache-Control": "no-store" } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : typeof e === "string" ? e : "unknown";
    return NextResponse.json({ error: message }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
