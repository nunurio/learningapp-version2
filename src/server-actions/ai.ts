"use server";
import { revalidatePath, revalidateTag } from "next/cache";
import type { UUID, CoursePlan, LessonCards } from "@/lib/types";
import { createClient, getCurrentUserId } from "@/lib/supabase/server";
import type { Tables, TablesInsert } from "@/lib/database.types";
import { DASHBOARD_TAG } from "@/lib/db/dashboard";

export async function saveDraftAction(
  kind: "outline" | "lesson-cards",
  payload: CoursePlan | LessonCards
): Promise<{ id: string }> {
  const supa = await createClient();
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("Not authenticated");
  const { data, error } = await supa
    .from("ai_drafts")
    .insert({ user_id: userId, kind, payload })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id };
}

export async function commitCoursePlanAction(draftId: string): Promise<{ courseId: UUID } | undefined> {
  const supa = await createClient();
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("Not authenticated");
  const { data: draft, error: e1 } = await supa
    .from("ai_drafts")
    .select("*")
    .eq("user_id", userId)
    .eq("id", draftId)
    .eq("kind", "outline")
    .maybeSingle();
  if (e1) throw e1;
  if (!draft) return undefined;
  const plan = draft.payload as CoursePlan;
  const { data: course, error: e2 } = await supa
    .from("courses")
    .insert({ owner_id: userId, title: plan.course.title, description: plan.course.description ?? null, category: plan.course.category ?? null, status: "draft" } satisfies TablesInsert<"courses">)
    .select("id")
    .single();
  if (e2) throw e2;
  const cid = course.id as UUID;
  // insert lessons with incremental order_index
  const rows: TablesInsert<"lessons">[] = plan.lessons.map((l, idx) => ({ course_id: cid, title: l.title, order_index: idx }));
  if (rows.length) {
    const { error: e3 } = await supa.from("lessons").insert(rows);
    if (e3) throw e3;
  }
  await supa.from("ai_drafts").delete().eq("id", draftId);
  revalidatePath("/dashboard");
  revalidateTag(DASHBOARD_TAG);
  return { courseId: cid };
}

export async function commitCoursePlanPartialAction(draftId: string, selectedIndexes: number[]): Promise<{ courseId: UUID } | undefined> {
  const supa = await createClient();
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("Not authenticated");
  const { data: draft, error: e1 } = await supa
    .from("ai_drafts")
    .select("*")
    .eq("user_id", userId)
    .eq("id", draftId)
    .eq("kind", "outline")
    .maybeSingle();
  if (e1) throw e1;
  if (!draft) return undefined;
  const plan = draft.payload as CoursePlan;
  const { data: course, error: e2 } = await supa
    .from("courses")
    .insert({ owner_id: userId, title: plan.course.title, description: plan.course.description ?? null, category: plan.course.category ?? null, status: "draft" } satisfies TablesInsert<"courses">)
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
    const { error: e3 } = await supa.from("lessons").insert(withOrder);
    if (e3) throw e3;
  }
  await supa.from("ai_drafts").delete().eq("id", draftId);
  revalidatePath("/dashboard");
  revalidateTag(DASHBOARD_TAG);
  return { courseId: cid };
}

export async function commitLessonCardsAction(opts: { draftId: string; lessonId: UUID }): Promise<{ count: number; cardIds: UUID[] } | undefined> {
  const supa = await createClient();
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("Not authenticated");
  const { data: draft, error: e1 } = await supa
    .from("ai_drafts")
    .select("*")
    .eq("user_id", userId)
    .eq("id", opts.draftId)
    .eq("kind", "lesson-cards")
    .maybeSingle();
  if (e1) throw e1;
  if (!draft) return undefined;
  const payload = draft.payload as LessonCards;
  const siblings = await supa
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
    const { data, error } = await supa.from("cards").insert(rows).select("id");
    if (error) throw error;
    count = data.length; ids.push(...data.map((r: { id: UUID }) => r.id));
  }
  await supa.from("ai_drafts").delete().eq("id", opts.draftId);
  const { data: lrow } = await supa.from("lessons").select("course_id").eq("id", opts.lessonId).single();
  if (lrow?.course_id) revalidatePath(`/courses/${lrow.course_id}/workspace`, "page");
  revalidatePath("/dashboard");
  revalidateTag(DASHBOARD_TAG);
  return { count, cardIds: ids };
}

export async function commitLessonCardsPartialAction(opts: { draftId: string; lessonId: UUID; selectedIndexes: number[] }): Promise<{ count: number; cardIds: UUID[] } | undefined> {
  const supa = await createClient();
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("Not authenticated");
  const { data: draft, error: e1 } = await supa
    .from("ai_drafts")
    .select("*")
    .eq("user_id", userId)
    .eq("id", opts.draftId)
    .eq("kind", "lesson-cards")
    .maybeSingle();
  if (e1) throw e1;
  if (!draft) return undefined;
  const payload = draft.payload as LessonCards;
  const set = new Set(opts.selectedIndexes);
  const selected = payload.cards.map((it, idx) => (set.has(idx) ? it : null)).filter(Boolean) as LessonCards["cards"];
  const siblings = await supa
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
    const { data, error } = await supa.from("cards").insert(rows).select("id");
    if (error) throw error;
    count = data.length; ids.push(...data.map((r: { id: UUID }) => r.id));
  }
  await supa.from("ai_drafts").delete().eq("id", opts.draftId);
  const { data: lrow } = await supa.from("lessons").select("course_id").eq("id", opts.lessonId).single();
  if (lrow?.course_id) revalidatePath(`/courses/${lrow.course_id}/workspace`, "page");
  revalidatePath("/dashboard");
  revalidateTag(DASHBOARD_TAG);
  return { count, cardIds: ids };
}
