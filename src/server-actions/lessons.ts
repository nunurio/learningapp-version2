"use server";
import { createClient } from "@/lib/supabase/server";
import type { UUID } from "@/lib/types";
import type { TablesInsert } from "@/lib/database.types";
import { asUpsertById } from "@/lib/db/helpers";

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
  return { lessonId: data.id };
}

export async function deleteLessonAction(lessonId: UUID) {
  const supa = await createClient();
  const { error } = await supa.from("lessons").delete().eq("id", lessonId);
  if (error) throw error;
}

export async function reorderLessonsAction(courseId: UUID, orderedIds: UUID[]) {
  const supa = await createClient();
  const updates = orderedIds.map((id, idx) => ({ id, order_index: idx }));
  const { error } = await supa
    .from("lessons")
    .upsert(asUpsertById<"lessons">(updates), { onConflict: "id" });
  if (error) throw error;
}
