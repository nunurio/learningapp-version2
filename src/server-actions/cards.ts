"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { UUID, Card } from "@/lib/types";
// asUpsertById not needed after switching to plain updates for reordering
import type { TablesInsert } from "@/lib/database.types";

export async function addCardAction(
  lessonId: UUID,
  card: Omit<Card, "id" | "lessonId" | "createdAt" | "orderIndex">
): Promise<UUID> {
  const supa = await createClient();
  const { data: lrow, error: le } = await supa.from("lessons").select("course_id").eq("id", lessonId).single();
  if (le) throw le;
  const { data: maxData, error: e1 } = await supa
    .from("cards")
    .select("order_index")
    .eq("lesson_id", lessonId)
    .order("order_index", { ascending: false })
    .limit(1);
  if (e1) throw e1;
  const nextIndex = maxData?.[0]?.order_index != null ? Number(maxData[0].order_index) + 1 : 0;
  const { data, error } = await supa
    .from("cards")
    .insert({
      lesson_id: lessonId,
      card_type: card.cardType,
      title: card.title ?? null,
      tags: card.tags ?? [],
      content: card.content,
      order_index: nextIndex,
    } satisfies TablesInsert<"cards">)
    .select("id")
    .single();
  if (error) throw error;
  revalidatePath(`/courses/${lrow.course_id}/workspace`, "page");
  return data.id as UUID;
}

export async function updateCardAction(cardId: UUID, patch: Partial<Card>) {
  const supa = await createClient();
  const { data: crow, error: ce } = await supa.from("cards").select("lesson_id").eq("id", cardId).single();
  if (ce) throw ce;
  const { data: lrow, error: le } = await supa.from("lessons").select("course_id").eq("id", crow.lesson_id).single();
  if (le) throw le;
  const updates: Record<string, unknown> = {};
  if (patch.title !== undefined) updates.title = patch.title;
  if (patch.tags !== undefined) updates.tags = patch.tags;
  if (patch.content !== undefined) updates.content = patch.content;
  if (patch.orderIndex !== undefined) updates.order_index = patch.orderIndex;
  if (Object.keys(updates).length === 0) return;
  const { error } = await supa.from("cards").update(updates).eq("id", cardId);
  if (error) throw error;
  revalidatePath(`/courses/${lrow.course_id}/workspace`, "page");
}

export async function deleteCardAction(cardId: UUID) {
  const supa = await createClient();
  const { data: crow, error: ce } = await supa.from("cards").select("lesson_id").eq("id", cardId).single();
  if (ce) throw ce;
  const { data: lrow, error: le } = await supa.from("lessons").select("course_id").eq("id", crow.lesson_id).single();
  const { error } = await supa.from("cards").delete().eq("id", cardId);
  if (error) throw error;
  if (!le) revalidatePath(`/courses/${lrow.course_id}/workspace`, "page");
}

export async function deleteCardsAction(ids: UUID[]) {
  if (!ids.length) return;
  const supa = await createClient();
  const { data: rows } = await supa.from("cards").select("lesson_id").in("id", ids);
  let courseId: string | undefined;
  if (rows && rows[0]) {
    const { data: lrow } = await supa.from("lessons").select("course_id").eq("id", rows[0].lesson_id).single();
    courseId = lrow?.course_id as string | undefined;
  }
  const { error } = await supa.from("cards").delete().in("id", ids);
  if (error) throw error;
  if (courseId) revalidatePath(`/courses/${courseId}/workspace`, "page");
}

export async function reorderCardsAction(lessonId: UUID, orderedIds: UUID[]) {
  const supa = await createClient();
  const { data: lrow, error: le } = await supa.from("lessons").select("course_id").eq("id", lessonId).single();
  if (le) throw le;
  // NOTE: Upsert can hit RLS/privilege checks (42501) on some setups
  // because it requires both INSERT and UPDATE permissions. Additionally,
  // unique (lesson_id, order_index) can transiently conflict. To avoid
  // both issues, perform two-phase plain updates with a large offset.
  const OFFSET = 1_000_000; // keep within int range and out of normal window
  // Phase 1: move to provisional window to avoid unique collisions.
  for (let idx = 0; idx < orderedIds.length; idx++) {
    const id = orderedIds[idx];
    const provisional = idx + OFFSET;
    const { error } = await supa
      .from("cards")
      .update({ order_index: provisional })
      .eq("id", id);
    if (error) throw error;
  }
  // Phase 2: set final indices 0..n-1.
  for (let idx = 0; idx < orderedIds.length; idx++) {
    const id = orderedIds[idx];
    const { error } = await supa
      .from("cards")
      .update({ order_index: idx })
      .eq("id", id);
    if (error) throw error;
  }
  revalidatePath(`/courses/${lrow.course_id}/workspace`, "page");
}
