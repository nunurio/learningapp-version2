"use server";
import type { UUID, Progress, SrsEntry, SrsRating } from "@/lib/types";
import { createClient, getCurrentUserId } from "@/lib/supabase/server";

export async function saveProgressAction(input: Progress) {
  const supa = await createClient();
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("Not authenticated");
  const { error } = await supa
    .from("progress")
    .upsert({
      user_id: userId,
      card_id: input.cardId,
      completed: !!input.completed,
      completed_at: input.completedAt ?? null,
      answer: input.answer ?? null,
    });
  if (error) throw error;
}

function startOfDayISO(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function rateSrsAction(cardId: UUID, rating: SrsRating): Promise<SrsEntry> {
  const supa = await createClient();
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("Not authenticated");
  const { data: prev, error: e1 } = await supa
    .from("srs")
    .select("*")
    .eq("user_id", userId)
    .eq("card_id", cardId)
    .maybeSingle();
  if (e1) throw e1;

  let ease = prev?.ease ?? 2.5;
  let interval = prev?.interval ?? 0;

  switch (rating) {
    case "again":
      ease = Math.max(1.3, ease - 0.2);
      interval = 0;
      break;
    case "hard":
      ease = Math.max(1.3, ease - 0.15);
      interval = interval > 0 ? Math.max(1, Math.round(interval * 1.2)) : 0;
      break;
    case "good":
      interval = interval > 0 ? Math.max(1, Math.round(interval * ease)) : 1;
      ease = Math.max(1.3, Math.min(3.0, ease));
      break;
    case "easy":
      interval = interval > 0 ? Math.max(1, Math.round(interval * ease * 1.3)) : 3;
      ease = Math.min(3.0, ease + 0.1);
      break;
  }

  const due = startOfDayISO(new Date(Date.now() + interval * 24 * 60 * 60 * 1000));
  const next: SrsEntry = { cardId, ease, interval, due, lastRating: rating };
  const { error } = await supa
    .from("srs")
    .upsert({
      user_id: userId,
      card_id: cardId,
      ease,
      interval,
      due: due.slice(0, 10),
      last_rating: rating,
    });
  if (error) throw error;
  return next;
}

export async function toggleFlagAction(cardId: UUID): Promise<boolean> {
  const supa = await createClient();
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("Not authenticated");
  const { data: row } = await supa
    .from("flags")
    .select("*")
    .eq("user_id", userId)
    .eq("card_id", cardId)
    .maybeSingle();
  if (!row) {
    const { error } = await supa.from("flags").insert({ user_id: userId, card_id: cardId });
    if (error) throw error;
    return true;
  } else {
    const { error } = await supa.from("flags").delete().eq("user_id", userId).eq("card_id", cardId);
    if (error) throw error;
    return false;
  }
}

export async function saveNoteAction(cardId: UUID, text: string) {
  const supa = await createClient();
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("Not authenticated");
  const { error } = await supa
    .from("notes")
    .upsert({ user_id: userId, card_id: cardId, text });
  if (error) throw error;
}
