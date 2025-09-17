"use client";
import type { UUID, Card } from "@/lib/types";
import { updateCard } from "@/lib/client-api";

// カード編集用の統一入力

export type CardSaveInput =
  | { cardId: UUID; cardType: "text"; title?: string | null; tags?: string[]; body: string }
  | {
      cardId: UUID;
      cardType: "quiz";
      title?: string | null;
      tags?: string[];
      question: string;
      options: string[];
      answerIndex: number;
      explanation?: string | null;
      optionExplanations?: (string | null)[];
      hint?: string | null;
    }
  | { cardId: UUID; cardType: "fill-blank"; title?: string | null; tags?: string[]; text: string; answers: Record<string, string>; caseSensitive?: boolean };

export type SaveCardDraftInput = CardSaveInput;

function buildUpdatePatch(input: CardSaveInput): Partial<Card> {
  if (input.cardType === "text") {
    return {
      title: input.title ?? null,
      tags: input.tags ?? undefined,
      content: { body: input.body },
    } satisfies Partial<Card>;
  }
  if (input.cardType === "quiz") {
    return {
      title: input.title ?? null,
      tags: input.tags ?? undefined,
      content: {
        question: input.question,
        options: input.options,
        answerIndex: input.answerIndex,
        explanation: input.explanation ?? undefined,
        optionExplanations: input.optionExplanations?.length ? input.optionExplanations : undefined,
        hint: input.hint ?? undefined,
      },
    } satisfies Partial<Card>;
  }
  return {
    title: input.title ?? null,
    tags: input.tags ?? undefined,
    content: {
      text: input.text,
      answers: input.answers,
      caseSensitive: input.caseSensitive ?? false,
    },
  } satisfies Partial<Card>;
}

export async function saveCard(input: CardSaveInput): Promise<{ updatedAt: string }> {
  await updateCard(input.cardId, buildUpdatePatch(input));
  const updatedAt = new Date().toISOString();
  return { updatedAt };
}
