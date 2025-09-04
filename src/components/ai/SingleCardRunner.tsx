"use client";
import { useEffect, useRef } from "react";
import { saveDraft, commitLessonCardsPartial } from "@/lib/client-api";
import type { LessonCards, UUID } from "@/lib/types";

type Props = {
  lessonId: UUID;
  lessonTitle: string;
  onLog: (lessonId: UUID, text: string) => void;
  onPreview?: (lessonId: UUID, draftId: string, payload: LessonCards) => void;
  onFinish: () => void; // called on done or error
};

export function SingleCardRunner({ lessonId, lessonTitle, onLog, onPreview, onFinish }: Props) {
  const logRef = useRef(onLog);
  const previewRef = useRef(onPreview);
  const finishRef = useRef(onFinish);
  useEffect(() => { logRef.current = onLog; previewRef.current = onPreview; finishRef.current = onFinish; }, [onLog, onPreview, onFinish]);

  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        logRef.current(lessonId, "received(single)");
        const res = await fetch("/api/ai/lesson-cards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lessonTitle, desiredCount: 1 }),
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { payload: LessonCards };
        if (aborted) return;
        const draft = await saveDraft("lesson-cards", data.payload);
        if (aborted) return;
        previewRef.current?.(lessonId, draft.id, data.payload);
        const committed = await commitLessonCardsPartial({ draftId: draft.id, lessonId, selectedIndexes: [0] });
        if (aborted) return;
        logRef.current(
          lessonId,
          committed
            ? `カードを自動保存しました（1 件）`
            : "カードの保存に失敗しました"
        );
      } catch (e: unknown) {
        const msg = (e as { message?: string })?.message ?? "unknown";
        if (!aborted) logRef.current(lessonId, `エラー: ${msg}`);
      } finally {
        if (!aborted) finishRef.current();
      }
    })();
    return () => { aborted = true; };
  }, [lessonId, lessonTitle]);
  return null;
}

