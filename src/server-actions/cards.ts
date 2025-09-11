"use server";
import * as supa from "@/lib/supabase/server";
import type { UUID, Card } from "@/lib/types";
// asUpsertById not needed after switching to plain updates for reordering
import type { TablesInsert } from "@/lib/database.types";
import { dashboardUserTag } from "@/lib/db/dashboard";
// getCurrentUserId will be accessed via supa namespace to avoid hard dependency in tests
import { safeRevalidatePath, safeRevalidateTag, getCurrentUserIdSafe } from "@/server-actions/utils";

export async function addCardAction(
  lessonId: UUID,
  card: Omit<Card, "id" | "lessonId" | "createdAt" | "orderIndex">
): Promise<UUID> {
  const supaClient = await supa.createClient();
  const { data: lrow, error: le } = await supaClient.from("lessons").select("course_id").eq("id", lessonId).single();
  if (le) throw le;
  const { data: maxData, error: e1 } = await supaClient
    .from("cards")
    .select("order_index")
    .eq("lesson_id", lessonId)
    .order("order_index", { ascending: false })
    .limit(1);
  if (e1) throw e1;
  const nextIndex = maxData?.[0]?.order_index != null ? Number(maxData[0].order_index) + 1 : 0;
  const { data, error } = await supaClient
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
  safeRevalidatePath(`/courses/${lrow.course_id}/workspace`, "page");
  safeRevalidatePath("/dashboard");
  const uid = await getCurrentUserIdSafe();
  if (uid) safeRevalidateTag(dashboardUserTag(uid));
  return data.id as UUID;
}

export async function updateCardAction(cardId: UUID, patch: Partial<Card>) {
  const supaClient = await supa.createClient();
  const { data: crow, error: ce } = await supaClient.from("cards").select("lesson_id").eq("id", cardId).single();
  if (ce) throw ce;
  const { data: lrow, error: le } = await supaClient.from("lessons").select("course_id").eq("id", crow.lesson_id).single();
  if (le) throw le;
  const updates: Record<string, unknown> = {};
  if (patch.title !== undefined) updates.title = patch.title;
  if (patch.tags !== undefined) updates.tags = patch.tags;
  if (patch.content !== undefined) updates.content = patch.content;
  if (patch.orderIndex !== undefined) updates.order_index = patch.orderIndex;
  if (Object.keys(updates).length === 0) return;
  const { error } = await supaClient.from("cards").update(updates).eq("id", cardId);
  if (error) throw error;
  safeRevalidatePath(`/courses/${lrow.course_id}/workspace`, "page");
  safeRevalidatePath("/dashboard");
  const uid2 = await getCurrentUserIdSafe();
  if (uid2) safeRevalidateTag(dashboardUserTag(uid2));
}

export async function deleteCardAction(cardId: UUID) {
  const supaClient = await supa.createClient();
  const { data: crow, error: ce } = await supaClient.from("cards").select("lesson_id").eq("id", cardId).single();
  if (ce) throw ce;
  const { data: lrow, error: le } = await supaClient.from("lessons").select("course_id").eq("id", crow.lesson_id).single();
  const { error } = await supaClient.from("cards").delete().eq("id", cardId);
  if (error) throw error;
  if (!le) {
    safeRevalidatePath(`/courses/${lrow.course_id}/workspace`, "page");
    safeRevalidatePath("/dashboard");
    const uid3 = await getCurrentUserIdSafe();
    if (uid3) safeRevalidateTag(dashboardUserTag(uid3));
  }
}

export async function deleteCardsAction(ids: UUID[]) {
  if (!ids.length) return;
  const supaClient = await supa.createClient();
  const { data: rows } = await supaClient.from("cards").select("lesson_id").in("id", ids);
  let courseId: string | undefined;
  if (rows && rows[0]) {
    const { data: lrow } = await supaClient.from("lessons").select("course_id").eq("id", rows[0].lesson_id).single();
    courseId = lrow?.course_id as string | undefined;
  }
  const { error } = await supaClient.from("cards").delete().in("id", ids);
  if (error) throw error;
  if (courseId) safeRevalidatePath(`/courses/${courseId}/workspace`, "page");
  safeRevalidatePath("/dashboard");
  const uid4 = await getCurrentUserIdSafe();
  if (uid4) safeRevalidateTag(dashboardUserTag(uid4));
}

export async function reorderCardsAction(lessonId: UUID, orderedIds: UUID[]) {
  const supaClient = await supa.createClient();
  // 1) Pre-flight: resolve course for revalidate and verify target set
  const { data: lrow, error: le } = await supaClient
    .from("lessons")
    .select("course_id")
    .eq("id", lessonId)
    .single();
  if (le) throw le;

  const { data: currentIdsRows, error: lidErr } = await supaClient
    .from("cards")
    .select("id, order_index")
    .eq("lesson_id", lessonId)
    .order("order_index", { ascending: true });
  if (lidErr) throw lidErr;
  const currentIds = (currentIdsRows ?? []).map((r) => r.id as string);
  // 同一集合かを検証（順序は異なってよい）
  const setEq = currentIds.length === orderedIds.length && new Set(currentIds).size === new Set(orderedIds).size && currentIds.every((id) => orderedIds.includes(id));
  if (!setEq) {
    throw new Error(`Invalid reorderCardsAction input: ids do not match lesson ${lessonId}. expected ${currentIds.length}, got ${orderedIds.length}`);
  }

  if (process.env.NODE_ENV !== "production") {
    console.debug(`[reorderCards] lesson=${lessonId} size=${orderedIds.length}`);
  }

  // 2) Two-phase UPDATE to avoid RLS upsert and unique conflicts
  const OFFSET = 1_000_000; // keep within int range and out of normal window
  // Keep original map for best-effort rollback
  const originalIndexById = new Map<string, number>(currentIdsRows?.map((r) => [r.id as string, Number(r.order_index)]) ?? []);

  try {
    // Phase 1: move to provisional window to avoid unique collisions.
    for (let idx = 0; idx < orderedIds.length; idx++) {
      const id = orderedIds[idx];
      const provisional = idx + OFFSET;
      const { error } = await supaClient
        .from("cards")
        .update({ order_index: provisional })
        .eq("id", id)
        .eq("lesson_id", lessonId);
      if (error) {
        // Surface Postgres code if present
        const code = (error as { code?: string }).code;
        throw new Error(`Phase1 update failed for card ${id}${code ? ` (code ${code})` : ""}: ${error.message}`);
      }
    }
    // Phase 2: set final indices 0..n-1.
    for (let idx = 0; idx < orderedIds.length; idx++) {
      const id = orderedIds[idx];
      const { error } = await supaClient
        .from("cards")
        .update({ order_index: idx })
        .eq("id", id)
        .eq("lesson_id", lessonId);
      if (error) {
        const code = (error as { code?: string }).code;
        throw new Error(`Phase2 update failed for card ${id}${code ? ` (code ${code})` : ""}: ${error.message}`);
      }
    }
  } catch (err) {
    // Best-effort rollback to original order using a separate staging window
    try {
      const OFFSET2 = 2_000_000;
      for (let idx = 0; idx < orderedIds.length; idx++) {
        const id = orderedIds[idx];
        const { error } = await supaClient
          .from("cards")
          .update({ order_index: OFFSET2 + idx })
          .eq("id", id)
          .eq("lesson_id", lessonId);
        if (error) break; // give up further rollback if this fails
      }
      for (const [id, orig] of originalIndexById.entries()) {
        const { error } = await supaClient
          .from("cards")
          .update({ order_index: orig })
          .eq("id", id)
          .eq("lesson_id", lessonId);
        if (error) break;
      }
    } catch {}
    throw err;
  }

  safeRevalidatePath(`/courses/${lrow.course_id}/workspace`, "page");
  safeRevalidatePath("/dashboard");
  const uid5 = await getCurrentUserIdSafe();
  if (uid5) safeRevalidateTag(dashboardUserTag(uid5));
}
