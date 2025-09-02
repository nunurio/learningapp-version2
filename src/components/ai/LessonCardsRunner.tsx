"use client";
import { useSSE } from "@/components/ai/useSSE";
import { saveDraft } from "@/lib/localdb";
import type { LessonCards, UUID } from "@/lib/types";

type Props = {
  lessonId: UUID;
  lessonTitle: string;
  onLog: (lessonId: UUID, text: string) => void;
  onPreview: (lessonId: UUID, draftId: string, payload: LessonCards) => void;
  onFinish: () => void; // called on done or error
};

export function LessonCardsRunner({ lessonId, lessonTitle, onLog, onPreview, onFinish }: Props) {
  type CardsUpdate = { node?: string; status?: string };
  type CardsDone = { payload: LessonCards; draftId: string };

  useSSE<CardsDone, CardsUpdate>("/api/ai/lesson-cards", { lessonTitle, desiredCount: 6 }, {
    onUpdate: (d) => onLog(lessonId, `${d?.node ?? d?.status}`),
    onDone: async (d) => {
      const payload = d?.payload as LessonCards;
      if (payload) {
        const draft = await saveDraft("lesson-cards", payload);
        onPreview(lessonId, draft.id, payload);
        onLog(lessonId, `下書きを保存しました（ID: ${draft.id}）`);
      }
      onFinish();
    },
    onError: (d) => {
      onLog(lessonId, `エラー: ${d?.message ?? "unknown"}`);
      onFinish();
    },
  });
  return null;
}
