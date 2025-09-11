"use server";
import * as supa from "@/lib/supabase/server";
import type { UUID } from "@/lib/types";
import type { TablesInsert } from "@/lib/database.types";
import { dashboardUserTag } from "@/lib/db/dashboard";
// getCurrentUserId will be accessed via supa namespace to avoid hard dependency in tests
import { safeRevalidatePath, safeRevalidateTag, getCurrentUserIdSafe } from "@/server-actions/utils";

export async function addLessonAction(courseId: UUID, title: string): Promise<{ lessonId: UUID }> {
  const supaClient = await supa.createClient();
  const { data: maxData, error: e1 } = await supaClient
    .from("lessons")
    .select("order_index")
    .eq("course_id", courseId)
    .order("order_index", { ascending: false })
    .limit(1);
  if (e1) throw e1;
  const nextIndex = maxData?.[0]?.order_index != null ? Number(maxData[0].order_index) + 1 : 0;
  const { data, error } = await supaClient
    .from("lessons")
    .insert({ course_id: courseId, title: title.trim(), order_index: nextIndex } satisfies TablesInsert<"lessons">)
    .select("id")
    .single();
  if (error) throw error;
  safeRevalidatePath(`/courses/${courseId}/workspace`, "page");
  safeRevalidatePath("/dashboard");
  const uid = await getCurrentUserIdSafe();
  if (uid) safeRevalidateTag(dashboardUserTag(uid));
  return { lessonId: data.id };
}

export async function deleteLessonAction(lessonId: UUID) {
  const supaClient = await supa.createClient();
  const { data: lrow } = await supaClient.from("lessons").select("course_id").eq("id", lessonId).single();
  const { error } = await supaClient.from("lessons").delete().eq("id", lessonId);
  if (error) throw error;
  if (lrow?.course_id) safeRevalidatePath(`/courses/${lrow.course_id}/workspace`, "page");
  safeRevalidatePath("/dashboard");
  const uid2 = await getCurrentUserIdSafe();
  if (uid2) safeRevalidateTag(dashboardUserTag(uid2));
}

export async function reorderLessonsAction(courseId: UUID, orderedIds: UUID[]) {
  const supaClient = await supa.createClient();
  // Verify target set belongs to course
  const { data: rows, error: selErr } = await supaClient
    .from("lessons")
    .select("id, order_index")
    .eq("course_id", courseId)
    .order("order_index", { ascending: true });
  if (selErr) throw selErr;
  const currentIds = (rows ?? []).map((r) => r.id as string);
  const setEq = currentIds.length === orderedIds.length && new Set(currentIds).size === new Set(orderedIds).size && currentIds.every((id) => orderedIds.includes(id));
  if (!setEq) {
    throw new Error(`Invalid reorderLessonsAction input: ids do not match course ${courseId}. expected ${currentIds.length}, got ${orderedIds.length}`);
  }
  if (process.env.NODE_ENV !== "production") {
    console.debug(`[reorderLessons] course=${courseId} size=${orderedIds.length}`);
  }

  // See cards reordering note: avoid UPSERT to prevent RLS 42501 and
  // transient unique conflicts on (course_id, order_index).
  const OFFSET = 1_000_000;
  const originalIndexById = new Map<string, number>(rows?.map((r) => [r.id as string, Number(r.order_index)]) ?? []);
  try {
    for (let idx = 0; idx < orderedIds.length; idx++) {
      const id = orderedIds[idx];
      const provisional = idx + OFFSET;
      const { error } = await supaClient
        .from("lessons")
        .update({ order_index: provisional })
        .eq("id", id)
        .eq("course_id", courseId);
      if (error) throw new Error(`Phase1 update failed for lesson ${id}${(error as { code?: string }).code ? ` (code ${(error as { code?: string }).code})` : ""}: ${error.message}`);
    }
    for (let idx = 0; idx < orderedIds.length; idx++) {
      const id = orderedIds[idx];
      const { error } = await supaClient
        .from("lessons")
        .update({ order_index: idx })
        .eq("id", id)
        .eq("course_id", courseId);
      if (error) throw new Error(`Phase2 update failed for lesson ${id}${(error as { code?: string }).code ? ` (code ${(error as { code?: string }).code})` : ""}: ${error.message}`);
    }
  } catch (err) {
    // Best-effort rollback
    try {
      const OFFSET2 = 2_000_000;
      for (let idx = 0; idx < orderedIds.length; idx++) {
        const id = orderedIds[idx];
        const { error } = await supaClient
          .from("lessons")
          .update({ order_index: OFFSET2 + idx })
          .eq("id", id)
          .eq("course_id", courseId);
        if (error) break;
      }
      for (const [id, orig] of originalIndexById.entries()) {
        const { error } = await supaClient
          .from("lessons")
          .update({ order_index: orig })
          .eq("id", id)
          .eq("course_id", courseId);
        if (error) break;
      }
    } catch {}
    throw err;
  }
  safeRevalidatePath(`/courses/${courseId}/workspace`, "page");
  safeRevalidatePath("/dashboard");
  const uid3 = await getCurrentUserIdSafe();
  if (uid3) safeRevalidateTag(dashboardUserTag(uid3));
}
