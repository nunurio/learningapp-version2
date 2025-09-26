"use server";
import type { UUID, Progress, SrsEntry, SrsRating } from "@/lib/types";
import * as supa from "@/lib/supabase/server";
import type { TablesInsert, Json } from "@/lib/database.types";
import { safeRevalidatePath, safeRevalidateTag, getCurrentUserIdSafe } from "@/server-actions/utils";
import { dashboardUserTag } from "@/lib/db/dashboard";

export async function saveProgressAction(input: Progress) {
  const supaClient = await supa.createClient();
  const userId = await getCurrentUserIdSafe();
  if (!userId) throw new Error("Not authenticated");
  // 既存の完了状態を取得して「true が勝つ」マージを行う
  const { data: prev, error: selErr } = await supaClient
    .from("progress")
    .select("completed, completed_at, answer")
    .eq("user_id", userId)
    .eq("card_id", input.cardId)
    .maybeSingle();
  if (selErr) throw selErr;

  const prevCompleted = !!prev?.completed;
  const nextCompleted = prevCompleted || !!input.completed;
  // completedAt は「初回完了時刻を保持」。
  // 既存が完了済みならそれを優先。未完→完了に変わる場合は入力値 or 現在時刻。
  const nextCompletedAt = nextCompleted
    ? (prevCompleted
        ? (prev?.completed_at ?? input.completedAt ?? null)
        : (input.completedAt ?? null))
    : null;

  // answer はオブジェクト同士ならフィールド単位でマージする。
  // それ以外（配列・プリミティブ・null）は入力値があれば全置換、未指定なら既存を保持。
  const isObjectRecord = (v: unknown): v is Record<string, unknown> =>
    v !== null && typeof v === "object" && !Array.isArray(v);

  const deepMerge = (base: unknown, patch: unknown): unknown => {
    if (isObjectRecord(base) && isObjectRecord(patch)) {
      const out: Record<string, unknown> = { ...base };
      for (const [k, pv] of Object.entries(patch)) {
        // undefined は「変更なし」と解釈（JSON へは保存されないため）。
        if (pv === undefined) continue;
        const bv = (base as Record<string, unknown>)[k];
        out[k] = isObjectRecord(bv) && isObjectRecord(pv) ? deepMerge(bv, pv) : pv;
      }
      return out;
    }
    return patch === undefined ? base : patch;
  };

  const prevAnswerUnknown = (prev?.answer as unknown) ?? null;
  let nextAnswer: Json | null;
  if (typeof input.answer === "undefined") {
    nextAnswer = (prevAnswerUnknown as Json) ?? null;
  } else if (isObjectRecord(prevAnswerUnknown) && isObjectRecord(input.answer)) {
    nextAnswer = deepMerge(prevAnswerUnknown, input.answer) as Json;
  } else {
    nextAnswer = (input.answer as Json | null);
  }

  const { error } = await supaClient
    .from("progress")
    .upsert({
      user_id: userId,
      card_id: input.cardId,
      completed: nextCompleted,
      completed_at: nextCompletedAt,
      answer: nextAnswer,
    } satisfies TablesInsert<"progress">);
  if (error) throw error;
  safeRevalidatePath("/dashboard");
  safeRevalidateTag(dashboardUserTag(userId));
}

function startOfDayISO(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function rateSrsAction(cardId: UUID, rating: SrsRating): Promise<SrsEntry> {
  const supaClient = await supa.createClient();
  const userId = await getCurrentUserIdSafe();
  if (!userId) throw new Error("Not authenticated");
  const { data: prev, error: e1 } = await supaClient
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
  const { error } = await supaClient
    .from("srs")
    .upsert({
      user_id: userId,
      card_id: cardId,
      ease,
      interval,
      due: due.slice(0, 10),
      last_rating: rating,
    } satisfies TablesInsert<"srs">);
  if (error) throw error;
  safeRevalidatePath("/dashboard");
  safeRevalidateTag(dashboardUserTag(userId));
  return next;
}

export async function toggleFlagAction(cardId: UUID): Promise<boolean> {
  const supaClient = await supa.createClient();
  const userId = await getCurrentUserIdSafe();
  if (!userId) throw new Error("Not authenticated");
  const { data: row } = await supaClient
    .from("flags")
    .select("*")
    .eq("user_id", userId)
    .eq("card_id", cardId)
    .maybeSingle();
  if (!row) {
    const { error } = await supaClient.from("flags").insert({ user_id: userId, card_id: cardId } satisfies TablesInsert<"flags">);
    if (error) throw error;
    safeRevalidatePath("/dashboard");
    safeRevalidateTag(dashboardUserTag(userId));
    return true;
  } else {
    const { error } = await supaClient.from("flags").delete().eq("user_id", userId).eq("card_id", cardId);
    if (error) throw error;
    safeRevalidatePath("/dashboard");
    safeRevalidateTag(dashboardUserTag(userId));
    return false;
  }
}

export async function createNoteAction(cardId: UUID, text: string): Promise<{ noteId: UUID; createdAt: string; updatedAt: string }> {
  const supaClient = await supa.createClient();
  const userId = await getCurrentUserIdSafe();
  if (!userId) throw new Error("Not authenticated");
  const { data, error } = await supaClient
    .from("notes")
    .insert({ user_id: userId, card_id: cardId, text } satisfies TablesInsert<"notes">)
    .select("id, created_at, updated_at")
    .single();
  if (error) throw error;
  if (!data) throw new Error("Failed to create note");
  safeRevalidatePath("/dashboard");
  safeRevalidateTag(dashboardUserTag(userId));
  return { noteId: data.id as UUID, createdAt: data.created_at, updatedAt: data.updated_at };
}

export async function updateNoteAction(noteId: UUID, patch: { text: string }): Promise<{ updatedAt: string }> {
  const supaClient = await supa.createClient();
  const userId = await getCurrentUserIdSafe();
  if (!userId) throw new Error("Not authenticated");
  const { data, error } = await supaClient
    .from("notes")
    .update({ text: patch.text })
    .eq("id", noteId)
    .select("updated_at")
    .single();
  if (error) throw error;
  if (!data) throw new Error("Note not found");
  safeRevalidatePath("/dashboard");
  safeRevalidateTag(dashboardUserTag(userId));
  return { updatedAt: data.updated_at };
}

export async function deleteNoteAction(noteId: UUID): Promise<void> {
  const supaClient = await supa.createClient();
  const userId = await getCurrentUserIdSafe();
  if (!userId) throw new Error("Not authenticated");
  const { error } = await supaClient.from("notes").delete().eq("id", noteId);
  if (error) throw error;
  safeRevalidatePath("/dashboard");
  safeRevalidateTag(dashboardUserTag(userId));
}
