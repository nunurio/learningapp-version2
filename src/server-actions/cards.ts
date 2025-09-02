"use server";
import { createClient } from "@/lib/supabase/server";
import type { UUID, Card } from "@/lib/types";

export async function addCardAction(
  lessonId: UUID,
  card: Omit<Card, "id" | "lessonId" | "createdAt" | "orderIndex">
): Promise<UUID> {
  const supa = await createClient();
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
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as UUID;
}

export async function updateCardAction(cardId: UUID, patch: Partial<Card>) {
  const supa = await createClient();
  const updates: Record<string, unknown> = {};
  if (patch.title !== undefined) updates.title = patch.title;
  if (patch.tags !== undefined) updates.tags = patch.tags;
  if (patch.content !== undefined) updates.content = patch.content;
  if (patch.orderIndex !== undefined) updates.order_index = patch.orderIndex;
  if (Object.keys(updates).length === 0) return;
  const { error } = await supa.from("cards").update(updates).eq("id", cardId);
  if (error) throw error;
}

export async function deleteCardAction(cardId: UUID) {
  const supa = await createClient();
  const { error } = await supa.from("cards").delete().eq("id", cardId);
  if (error) throw error;
}

export async function deleteCardsAction(ids: UUID[]) {
  if (!ids.length) return;
  const supa = await createClient();
  const { error } = await supa.from("cards").delete().in("id", ids);
  if (error) throw error;
}

export async function reorderCardsAction(lessonId: UUID, orderedIds: UUID[]) {
  const supa = await createClient();
  const updates = orderedIds.map((id, idx) => ({ id, order_index: idx }));
  const { error } = await supa.from("cards").upsert(updates, { onConflict: "id" });
  if (error) throw error;
}
