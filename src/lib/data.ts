"use client";
import type { UUID, CardType } from "@/lib/types";
import { draftsPut, draftsGet, draftsDelete, type DraftRow } from "@/lib/idb";
import { updateCard } from "@/lib/localdb";

// Inspector 用の下書き保存 + 公開

export type SaveCardDraftInput =
  | { cardId: UUID; cardType: "text"; title?: string | null; tags?: string[]; body: string }
  | { cardId: UUID; cardType: "quiz"; title?: string | null; tags?: string[]; question: string; options: string[]; answerIndex: number; explanation?: string | null }
  | { cardId: UUID; cardType: "fill-blank"; title?: string | null; tags?: string[]; text: string; answers: Record<string, string>; caseSensitive?: boolean };

export async function saveCardDraft(input: SaveCardDraftInput): Promise<{ updatedAt: string }> {
  const key = `card:${input.cardId}`;
  const updatedAt = new Date().toISOString();
  const row: DraftRow = {
    key,
    cardId: input.cardId,
    cardType: input.cardType,
    title: (input as any).title ?? null,
    data: input,
    updatedAt,
  };
  await draftsPut(row);
  return { updatedAt };
}

export async function loadCardDraft(cardId: UUID): Promise<SaveCardDraftInput | undefined> {
  const row = await draftsGet(`card:${cardId}`);
  return row?.data as SaveCardDraftInput | undefined;
}

export async function publishCard(cardId: UUID): Promise<void> {
  const row = await draftsGet(`card:${cardId}`);
  if (!row) return;
  const d = row.data as SaveCardDraftInput;
  if (d.cardType === "text") {
    updateCard(d.cardId, {
      title: d.title ?? null,
      tags: d.tags ?? undefined,
      content: { body: d.body },
    });
  } else if (d.cardType === "quiz") {
    updateCard(d.cardId, {
      title: d.title ?? null,
      tags: d.tags ?? undefined,
      content: {
        question: d.question,
        options: d.options,
        answerIndex: d.answerIndex,
        explanation: d.explanation ?? undefined,
      },
    });
  } else if (d.cardType === "fill-blank") {
    updateCard(d.cardId, {
      title: d.title ?? null,
      tags: d.tags ?? undefined,
      content: {
        text: d.text,
        answers: d.answers,
        caseSensitive: d.caseSensitive ?? false,
      },
    });
  }
  await draftsDelete(`card:${cardId}`);
}
