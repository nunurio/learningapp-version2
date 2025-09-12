"use server";
import * as supa from "@/lib/supabase/server";
import type { UUID, Course } from "@/lib/types";
import type { TablesInsert } from "@/lib/database.types";
import { dashboardUserTag } from "@/lib/db/dashboard";
import { safeRevalidatePath, safeRevalidateTag, getCurrentUserIdSafe } from "@/server-actions/utils";

export async function createCourseAction(input: { title: string; description?: string; category?: string }): Promise<{ courseId: UUID }> {
  const supaClient = await supa.createClient();
  const ownerId = ("getCurrentUserId" in supa)
    ? (await (supa as unknown as { getCurrentUserId: () => Promise<string | undefined> }).getCurrentUserId())
    : undefined;
  if (!ownerId) throw new Error("Not authenticated");
  const { data, error } = await supaClient
    .from("courses")
    .insert({
      owner_id: ownerId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      category: input.category?.trim() || null,
      status: "draft",
    } satisfies TablesInsert<"courses">)
    .select("id")
    .single();
  if (error) throw error;
  safeRevalidatePath("/");
  safeRevalidatePath("/dashboard");
  const tag = dashboardUserTag(ownerId);
  safeRevalidateTag(tag);
  return { courseId: data.id };
}

export async function updateCourseAction(courseId: UUID, patch: Partial<Pick<Course, "title" | "description" | "category" | "status">>) {
  const supaClient = await supa.createClient();
  const updates: Record<string, unknown> = {};
  if (patch.title !== undefined) updates.title = patch.title;
  if (patch.description !== undefined) updates.description = patch.description;
  if (patch.category !== undefined) updates.category = patch.category;
  if (patch.status !== undefined) updates.status = patch.status;
  if (Object.keys(updates).length === 0) return;
  const { error } = await supaClient.from("courses").update(updates).eq("id", courseId);
  if (error) throw error;
  safeRevalidatePath("/");
  safeRevalidatePath("/dashboard");
  const uid = await getCurrentUserIdSafe();
  if (uid) safeRevalidateTag(dashboardUserTag(uid));
  safeRevalidatePath(`/courses/${courseId}/workspace`, "page");
}

export async function deleteCourseAction(courseId: UUID) {
  const supaClient = await supa.createClient();
  const { error } = await supaClient.from("courses").delete().eq("id", courseId);
  if (error) throw error;
  safeRevalidatePath("/");
  safeRevalidatePath("/dashboard");
  const uid2 = await getCurrentUserIdSafe();
  if (uid2) safeRevalidateTag(dashboardUserTag(uid2));
  safeRevalidatePath(`/courses/${courseId}/workspace`, "page");
}
