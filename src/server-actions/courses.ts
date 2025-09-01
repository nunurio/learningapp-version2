"use server";
import { revalidatePath } from "next/cache";
import { createClient, getCurrentUserId } from "@/lib/supabase/server";
import type { UUID, Course } from "@/lib/types";

export async function createCourseAction(input: { title: string; description?: string; category?: string }): Promise<{ courseId: UUID }> {
  const supa = await createClient();
  const ownerId = await getCurrentUserId();
  if (!ownerId) throw new Error("Not authenticated");
  const { data, error } = await supa
    .from("courses")
    .insert({
      owner_id: ownerId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      category: input.category?.trim() || null,
      status: "draft",
    })
    .select("id")
    .single();
  if (error) throw error;
  revalidatePath("/");
  return { courseId: data.id };
}

export async function updateCourseAction(courseId: UUID, patch: Partial<Pick<Course, "title" | "description" | "category" | "status">>) {
  const supa = await createClient();
  const updates: Record<string, unknown> = {};
  if (patch.title !== undefined) updates.title = patch.title;
  if (patch.description !== undefined) updates.description = patch.description;
  if (patch.category !== undefined) updates.category = patch.category;
  if (patch.status !== undefined) updates.status = patch.status;
  if (Object.keys(updates).length === 0) return;
  const { error } = await supa.from("courses").update(updates).eq("id", courseId);
  if (error) throw error;
  revalidatePath("/");
}

export async function deleteCourseAction(courseId: UUID) {
  const supa = await createClient();
  const { error } = await supa.from("courses").delete().eq("id", courseId);
  if (error) throw error;
  revalidatePath("/");
}
