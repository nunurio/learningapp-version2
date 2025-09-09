"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { saveDraft, commitLessonCardsPartial } from "@/lib/client-api";
import type { LessonCards, UUID, CardType } from "@/lib/types";

type Props = {
  courseId: UUID;
  lessonId: UUID;
  lessonTitle: string;
  desiredCardType?: CardType;
  userBrief?: string;
  onLog: (lessonId: UUID, text: string) => void;
  onPreview?: (lessonId: UUID, draftId: string, payload: LessonCards) => void;
  onFinish: () => void; // called on done or error
};

export function SingleCardRunner({ courseId, lessonId, lessonTitle, desiredCardType, userBrief, onLog, onPreview, onFinish }: Props) {
  const router = useRouter();
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
          body: JSON.stringify({ lessonTitle, desiredCount: 1, courseId, desiredCardType, userBrief }),
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
        // 追加したカードをワークスペースで選択状態にし、学習モード遷移で cardId が乗るようにする
        if (committed && committed.cardIds && committed.cardIds[0]) {
          const newId = committed.cardIds[0];
          // lesson スコープは WorkspaceShell 側の推定で付与されるため cardId のみで十分
          router.push(`/courses/${courseId}/workspace?cardId=${encodeURIComponent(newId)}`);
        }
      } catch (e: unknown) {
        const msg = (e as { message?: string })?.message ?? "unknown";
        if (!aborted) logRef.current(lessonId, `エラー: ${msg}`);
      } finally {
        if (!aborted) finishRef.current();
      }
    })();
    return () => { aborted = true; };
  }, [lessonId, lessonTitle, courseId, desiredCardType, userBrief]);
  return null;
}
