"use client";
import { useEffect, useRef } from "react";
import { saveDraft, commitLessonCards } from "@/lib/client-api";
import type { LessonCards, UUID } from "@/lib/types";

type Props = {
  courseId: UUID;
  lessonId: UUID;
  lessonTitle: string;
  onLog: (lessonId: UUID, text: string) => void;
  onPreview: (lessonId: UUID, draftId: string, payload: LessonCards) => void;
  onFinish: () => void; // called on done or error
};

export function LessonCardsRunner({ courseId, lessonId, lessonTitle, onLog, onPreview, onFinish }: Props) {
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
          body: JSON.stringify({ lessonTitle, desiredCount: 6, courseId }),
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { payload: LessonCards };
        if (aborted) return;
        const draft = await saveDraft("lesson-cards", data.payload);
        if (aborted) return;
        // 以前はプレビューを表示してユーザーの選択を待っていたが、
        // 要件に合わせて直ちに全件をコミットする。
        const committed = await commitLessonCards({ draftId: draft.id, lessonId });
        if (aborted) return;
        logRef.current(
          lessonId,
          committed
            ? `カードを自動保存しました（${committed.count} 件）`
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
  }, [lessonId, lessonTitle, courseId]);
  return null;
}
