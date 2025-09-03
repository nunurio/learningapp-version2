"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { UUID } from "@/lib/types";
import type { TablesInsert } from "@/lib/database.types";

export async function addLessonAction(courseId: UUID, title: string): Promise<{ lessonId: UUID }> {
  const supa = await createClient();
  const { data: maxData, error: e1 } = await supa
    .from("lessons")
    .select("order_index")
    .eq("course_id", courseId)
    .order("order_index", { ascending: false })
    .limit(1);
  if (e1) throw e1;
  const nextIndex = maxData?.[0]?.order_index != null ? Number(maxData[0].order_index) + 1 : 0;
  const { data, error } = await supa
    .from("lessons")
    .insert({ course_id: courseId, title: title.trim(), order_index: nextIndex } satisfies TablesInsert<"lessons">)
    .select("id")
    .single();
  if (error) throw error;
  revalidatePath(`/courses/${courseId}/workspace`, "page");
  return { lessonId: data.id };
}

export async function deleteLessonAction(lessonId: UUID) {
  const supa = await createClient();
  const { data: lrow } = await supa.from("lessons").select("course_id").eq("id", lessonId).single();
  const { error } = await supa.from("lessons").delete().eq("id", lessonId);
  if (error) throw error;
  if (lrow?.course_id) revalidatePath(`/courses/${lrow.course_id}/workspace`, "page");
}

export async function reorderLessonsAction(courseId: UUID, orderedIds: UUID[]) {
  const supa = await createClient();
  // See cards reordering note: avoid UPSERT to prevent RLS 42501 and
  // transient unique conflicts on (course_id, order_index).
  const OFFSET = 1_000_000;
  for (let idx = 0; idx < orderedIds.length; idx++) {
    const id = orderedIds[idx];
    const provisional = idx + OFFSET;
    const { error } = await supa
      .from("lessons")
      .update({ order_index: provisional })
      .eq("id", id);
    if (error) throw error;
  }
  for (let idx = 0; idx < orderedIds.length; idx++) {
    const id = orderedIds[idx];
    const { error } = await supa
      .from("lessons")
      .update({ order_index: idx })
      .eq("id", id);
    if (error) throw error;
  }
  revalidatePath(`/courses/${courseId}/workspace`, "page");
}
