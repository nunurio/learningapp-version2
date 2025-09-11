"use server";
import { safeRevalidatePath, safeRevalidateTag, getCurrentUserIdSafe } from "@/server-actions/utils";
import type { UUID, CoursePlan, LessonCards } from "@/lib/types";
import * as supa from "@/lib/supabase/server";
import type { Tables, TablesInsert } from "@/lib/database.types";
import { DASHBOARD_TAG } from "@/lib/db/dashboard";
import { shouldUseMockAI, createLessonCardsPlanMock, createLessonCardsMock } from "@/lib/ai/mock";
import { getCourse, listLessons } from "@/lib/db/queries";
import { initAgents } from "@/lib/ai/agents";
import { runCardsPlanner } from "@/lib/ai/agents/planner";
import { runSingleCardAgent } from "@/lib/ai/agents/lesson-cards";
import type { AiUpdate } from "@/lib/ai/log";

export async function saveDraftAction(
  kind: "outline" | "lesson-cards",
  payload: CoursePlan | LessonCards
): Promise<{ id: string }> {
  const supaClient = await supa.createClient();
  const userId = await getCurrentUserIdSafe();
  if (!userId) throw new Error("Not authenticated");
  const { data, error } = await supaClient
    .from("ai_drafts")
    .insert({ user_id: userId, kind, payload })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id };
}

export async function commitCoursePlanAction(draftId: string): Promise<{ courseId: UUID } | undefined> {
  const supaClient2 = await supa.createClient();
  const userId2 = await getCurrentUserIdSafe();
  if (!userId2) throw new Error("Not authenticated");
  const { data: draft, error: e1 } = await supaClient2
    .from("ai_drafts")
    .select("*")
    .eq("user_id", userId2)
    .eq("id", draftId)
    .eq("kind", "outline")
    .maybeSingle();
  if (e1) throw e1;
  if (!draft) return undefined;
  const plan = draft.payload as CoursePlan;
  const { data: course, error: e2 } = await supaClient2
    .from("courses")
    .insert({ owner_id: userId2, title: plan.course.title, description: plan.course.description ?? null, category: plan.course.category ?? null, level: (plan.course as { level?: string | null }).level ?? null, status: "draft" } satisfies TablesInsert<"courses">)
    .select("id")
    .single();
  if (e2) throw e2;
  const cid = course.id as UUID;
  // insert lessons with incremental order_index
  const rows: TablesInsert<"lessons">[] = plan.lessons.map((l, idx) => ({ course_id: cid, title: l.title, order_index: idx }));
  if (rows.length) {
    const { error: e3 } = await supaClient2.from("lessons").insert(rows);
    if (e3) throw e3;
  }
  await supaClient2.from("ai_drafts").delete().eq("id", draftId);
  safeRevalidatePath("/dashboard");
  safeRevalidateTag(DASHBOARD_TAG);
  return { courseId: cid };
}

export async function commitCoursePlanPartialAction(draftId: string, selectedIndexes: number[]): Promise<{ courseId: UUID } | undefined> {
  const supaClient3 = await supa.createClient();
  const userId3 = await getCurrentUserIdSafe();
  if (!userId3) throw new Error("Not authenticated");
  const { data: draft, error: e1 } = await supaClient3
    .from("ai_drafts")
    .select("*")
    .eq("user_id", userId3)
    .eq("id", draftId)
    .eq("kind", "outline")
    .maybeSingle();
  if (e1) throw e1;
  if (!draft) return undefined;
  const plan = draft.payload as CoursePlan;
  const { data: course, error: e2 } = await supaClient3
    .from("courses")
    .insert({ owner_id: userId3, title: plan.course.title, description: plan.course.description ?? null, category: plan.course.category ?? null, level: (plan.course as { level?: string | null }).level ?? null, status: "draft" } satisfies TablesInsert<"courses">)
    .select("id")
    .single();
  if (e2) throw e2;
  const cid = course.id as UUID;
  const set = new Set(selectedIndexes);
  const rows = plan.lessons
    .map((l, idx) => (set.has(idx) ? { course_id: cid, title: l.title } : null))
    .filter(Boolean) as Pick<Tables<"lessons">, "course_id" | "title">[];
  const withOrder: TablesInsert<"lessons">[] = rows.map((r, idx) => ({ ...r, order_index: idx }));
  if (withOrder.length) {
    const { error: e3 } = await supaClient3.from("lessons").insert(withOrder);
    if (e3) throw e3;
  }
  await supaClient3.from("ai_drafts").delete().eq("id", draftId);
  safeRevalidatePath("/dashboard");
  safeRevalidateTag(DASHBOARD_TAG);
  return { courseId: cid };
}

export async function commitLessonCardsAction(opts: { draftId: string; lessonId: UUID }): Promise<{ count: number; cardIds: UUID[] } | undefined> {
  const supaClient4 = await supa.createClient();
  const userId4 = await getCurrentUserIdSafe();
  if (!userId4) throw new Error("Not authenticated");
  const { data: draft, error: e1 } = await supaClient4
    .from("ai_drafts")
    .select("*")
    .eq("user_id", userId4)
    .eq("id", opts.draftId)
    .eq("kind", "lesson-cards")
    .maybeSingle();
  if (e1) throw e1;
  if (!draft) return undefined;
  const payload = draft.payload as LessonCards;
  const siblings = await supaClient4
    .from("cards")
    .select("order_index")
    .eq("lesson_id", opts.lessonId)
    .order("order_index", { ascending: false })
    .limit(1);
  if (siblings.error) throw siblings.error;
  let next = siblings.data?.[0]?.order_index != null ? Number(siblings.data[0].order_index) + 1 : 0;
  const rows: TablesInsert<"cards">[] = payload.cards.map((item) => ({
    lesson_id: opts.lessonId,
    card_type: item.type,
    title: "title" in item ? (item.title ?? null) : null,
    tags: [],
    content: item,
    order_index: next++,
  }));
  let count = 0; const ids: UUID[] = [];
  if (rows.length) {
    const { data, error } = await supaClient4.from("cards").insert(rows).select("id");
    if (error) throw error;
    count = data.length; ids.push(...data.map((r: { id: UUID }) => r.id));
  }
  await supaClient4.from("ai_drafts").delete().eq("id", opts.draftId);
  const { data: lrow } = await supaClient4.from("lessons").select("course_id").eq("id", opts.lessonId).single();
  if (lrow?.course_id) safeRevalidatePath(`/courses/${lrow.course_id}/workspace`, "page");
  safeRevalidatePath("/dashboard");
  safeRevalidateTag(DASHBOARD_TAG);
  return { count, cardIds: ids };
}

export async function commitLessonCardsPartialAction(opts: { draftId: string; lessonId: UUID; selectedIndexes: number[] }): Promise<{ count: number; cardIds: UUID[] } | undefined> {
  const supaClient5 = await supa.createClient();
  const userId5 = await getCurrentUserIdSafe();
  if (!userId5) throw new Error("Not authenticated");
  const { data: draft, error: e1 } = await supaClient5
    .from("ai_drafts")
    .select("*")
    .eq("user_id", userId5)
    .eq("id", opts.draftId)
    .eq("kind", "lesson-cards")
    .maybeSingle();
  if (e1) throw e1;
  if (!draft) return undefined;
  const payload = draft.payload as LessonCards;
  const set = new Set(opts.selectedIndexes);
  const selected = payload.cards.map((it, idx) => (set.has(idx) ? it : null)).filter(Boolean) as LessonCards["cards"];
  const siblings = await supaClient5
    .from("cards")
    .select("order_index")
    .eq("lesson_id", opts.lessonId)
    .order("order_index", { ascending: false })
    .limit(1);
  if (siblings.error) throw siblings.error;
  let next = siblings.data?.[0]?.order_index != null ? Number(siblings.data[0].order_index) + 1 : 0;
  const rows: TablesInsert<"cards">[] = selected.map((item) => ({
    lesson_id: opts.lessonId,
    card_type: item.type,
    title: "title" in item ? (item.title ?? null) : null,
    tags: [],
    content: item,
    order_index: next++,
  }));
  let count = 0; const ids: UUID[] = [];
  if (rows.length) {
    const { data, error } = await supaClient5.from("cards").insert(rows).select("id");
    if (error) throw error;
    count = data.length; ids.push(...data.map((r: { id: UUID }) => r.id));
  }
  await supaClient5.from("ai_drafts").delete().eq("id", opts.draftId);
  const { data: lrow } = await supaClient5.from("lessons").select("course_id").eq("id", opts.lessonId).single();
  if (lrow?.course_id) safeRevalidatePath(`/courses/${lrow.course_id}/workspace`, "page");
  safeRevalidatePath("/dashboard");
  safeRevalidateTag(DASHBOARD_TAG);
  return { count, cardIds: ids };
}

// --- Batch generation (server-side parallel) ---------------------------------
export async function generateLessonCardsParallelAction(input: {
  courseId: UUID;
  lessonId: UUID;
  lessonTitle: string;
  desiredCount?: number;
}): Promise<{ draftId: string; payload: LessonCards; committed?: { count: number; cardIds: UUID[] }; updates: AiUpdate[] }> {
  const updates: AiUpdate[] = [];
  const now = () => Date.now();
  updates.push({ ts: now(), text: "received" }, { ts: now(), text: "planCards" });

  // Resolve planning context from DB
  let plan: { lessonTitle: string; count: number; sharedPrefix?: string | null; cards: { type: LessonCards["cards"][number]["type"]; brief: string; title?: string | null }[] };
  const useMock = shouldUseMockAI();
  try {
    const [course, lessons] = await Promise.all([getCourse(input.courseId), listLessons(input.courseId)]);
    const idx = lessons.findIndex((l) => l.title === input.lessonTitle);
    const level = (course as { level?: string | null } | undefined)?.level ?? "初心者";
    const context = {
      course: course ? { title: course.title, description: course.description ?? null, category: course.category ?? null, level } : { title: input.lessonTitle },
      lessons: lessons.map((l) => ({ title: l.title })),
      index: idx >= 0 ? idx : 0,
    } as const;
    if (useMock) {
      plan = createLessonCardsPlanMock({ lessonTitle: input.lessonTitle, desiredCount: input.desiredCount, course: context.course, lessons: context.lessons, index: context.index });
    } else {
      initAgents();
      const p = await runCardsPlanner({ lessonTitle: input.lessonTitle, desiredCount: input.desiredCount, context });
      plan = { lessonTitle: p.lessonTitle, count: p.count, sharedPrefix: p.sharedPrefix ?? null, cards: p.cards };
    }
  } catch (e) {
    throw e instanceof Error ? e : new Error(String(e));
  }
  // Use the actual cards length to avoid out-of-bounds when the
  // planner's declared count and provided cards array disagree.
  const total = plan.cards.length;
  if (plan.count != null && plan.count !== total) {
    updates.push({ ts: now(), text: `planMismatch(count=${plan.count}, cards=${total})` });
  }
  updates.push({ ts: now(), text: `planReady(${total})` });

  // Parallel single-card generation with retry
  // NOTE: Be robust to non-numeric env values (e.g. "auto", "true").
  const DEFAULT_CONCURRENCY = 10;
  const rawConcurrency = process.env.AI_CONCURRENCY ?? process.env.NEXT_PUBLIC_AI_CONCURRENCY;
  let resolvedConcurrency = DEFAULT_CONCURRENCY;
  if (typeof rawConcurrency === "string" && rawConcurrency.trim().length > 0) {
    const parsed = Number.parseInt(rawConcurrency.trim(), 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      resolvedConcurrency = parsed;
    } else {
      // Fallback and record the fallback reason for diagnostics.
      updates.push({ ts: now(), text: `concurrencyFallback(${rawConcurrency})→${DEFAULT_CONCURRENCY}` });
    }
  }
  // Cap to a sensible range. If total=0, spawn a single no-op worker.
  const concurrency = total > 0 ? Math.max(1, Math.min(resolvedConcurrency, total)) : 1;
  const slots: (LessonCards["cards"][number] | undefined)[] = Array.from({ length: total });
  let nextIndex = 0;
  let completed = 0;

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  async function generateWithRetry(i: number, item: { type: LessonCards["cards"][number]["type"]; brief: string; title?: string | null }) {
    const maxAttempts = 3;
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const payload = useMock
          ? createLessonCardsMock({ lessonTitle: plan.lessonTitle, desiredCount: 1, desiredCardType: item.type, userBrief: item.brief })
          : await runSingleCardAgent({ lessonTitle: plan.lessonTitle, desiredCardType: item.type, userBrief: item.brief, sharedPrefix: plan.sharedPrefix ?? undefined });
        const card = payload.cards[0];
        if (item.title && "title" in card) (card as { title?: string | null }).title = item.title;
        slots[i] = card;
        return;
      } catch (e) {
        lastError = e;
        if (attempt < maxAttempts) {
          const base = 250 * Math.pow(2, attempt - 1);
          const jitter = Math.floor(Math.random() * 120);
          await sleep(base + jitter);
          continue;
        }
        break;
      }
    }
    // fill placeholder if all attempts failed
    const msg = (lastError as { message?: string } | undefined)?.message ?? "unknown";
    slots[i] = { type: "text", title: item.title ?? null, body: `生成に失敗しました: ${msg}` } as LessonCards["cards"][number];
  }

  async function worker() {
    while (true) {
      const i = nextIndex++;
      if (i >= total) break;
      const item = plan.cards[i];
      // Extra guard: skip if planner forgot to supply this index
      if (!item) {
        updates.push({ ts: now(), text: `skipMissing ${i + 1}/${total}` });
      } else {
        await generateWithRetry(i, item);
      }
      completed += 1;
      updates.push({ ts: now(), text: `generateCard ${completed}/${total}` });
    }
  }

  await Promise.all(Array.from({ length: concurrency }).map(() => worker()));

  const cards = slots.map((c, i) => c ?? ({ type: "text", title: null, body: `未生成スロット ${i + 1}` } as LessonCards["cards"][number]));
  const payload: LessonCards = { lessonTitle: input.lessonTitle, cards };

  // Persist draft and commit immediately
  const draft = await saveDraftAction("lesson-cards", payload);
  updates.push({ ts: now(), text: "persistPreview" });
  const committed = await commitLessonCardsAction({ draftId: draft.id, lessonId: input.lessonId });
  if (committed) updates.push({ ts: now(), text: `コミット ${committed.count} 件` });

  return { draftId: draft.id, payload, committed, updates };
}

// --- Single card generation (server-side) -----------------------------------
export async function generateSingleCardAction(input: {
  courseId?: UUID;
  lessonId: UUID;
  lessonTitle: string;
  desiredCardType?: LessonCards["cards"][number]["type"];
  userBrief?: string;
}): Promise<{ draftId: string; payload: LessonCards; committed?: { count: number; cardIds: UUID[] }; updates: AiUpdate[] }> {
  const updates: AiUpdate[] = [];
  const now = () => Date.now();
  updates.push({ ts: now(), text: "received(single)" });

  let course: { title: string; description?: string | null; category?: string | null; level?: string | null } | undefined;
  if (input.courseId) {
    try {
      const co = await getCourse(input.courseId);
      if (co) course = { title: co.title, description: co.description ?? null, category: co.category ?? null, level: (co as { level?: string | null }).level ?? "初心者" };
    } catch {}
  }

  const useMock = shouldUseMockAI();
  const payload = useMock
    ? createLessonCardsMock({ lessonTitle: input.lessonTitle, desiredCount: 1, desiredCardType: input.desiredCardType, userBrief: input.userBrief })
    : (initAgents(), await runSingleCardAgent({ lessonTitle: input.lessonTitle, course, desiredCardType: input.desiredCardType, userBrief: input.userBrief }));

  const draft = await saveDraftAction("lesson-cards", payload);
  updates.push({ ts: now(), text: "persistPreview" });
  const committed = await commitLessonCardsPartialAction({ draftId: draft.id, lessonId: input.lessonId, selectedIndexes: [0] });
  if (committed) updates.push({ ts: now(), text: `コミット ${committed.count} 件` });
  return { draftId: draft.id, payload, committed, updates };
}
