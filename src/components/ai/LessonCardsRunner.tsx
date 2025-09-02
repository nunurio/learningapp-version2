"use client";
import { useEffect, useRef } from "react";
import { saveDraft } from "@/lib/client-api";
import type { LessonCards, UUID } from "@/lib/types";

type Props = {
  lessonId: UUID;
  lessonTitle: string;
  onLog: (lessonId: UUID, text: string) => void;
  onPreview: (lessonId: UUID, draftId: string, payload: LessonCards) => void;
  onFinish: () => void; // called on done or error
};

export function LessonCardsRunner({ lessonId, lessonTitle, onLog, onPreview, onFinish }: Props) {
  const logRef = useRef(onLog);
  const previewRef = useRef(onPreview);
  const finishRef = useRef(onFinish);
  useEffect(() => { logRef.current = onLog; previewRef.current = onPreview; finishRef.current = onFinish; }, [onLog, onPreview, onFinish]);

  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        logRef.current(lessonId, "received");
        const res = await fetch("/api/ai/lesson-cards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lessonTitle, desiredCount: 6 }),
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { payload: LessonCards };
        if (aborted) return;
        const draft = await saveDraft("lesson-cards", data.payload);
        if (aborted) return;
        previewRef.current(lessonId, draft.id, data.payload);
        logRef.current(lessonId, `下書きを保存しました（ID: ${draft.id}）`);
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
