"use client";
import { useEffect, useRef } from "react";
// グローバルに一度だけ型を拡張
declare global {
  var __ai_inflight: Set<string> | undefined;
}
import { generateLessonCardsParallel } from "@/lib/client-api";
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
  // dev StrictMode の副作用による二重起動を抑止する軽量ガード（型安全）
  const key = `${lessonId}-batch`;
  function ensureInflight(): Set<string> {
    if (!globalThis.__ai_inflight) globalThis.__ai_inflight = new Set<string>();
    return globalThis.__ai_inflight;
  }
  const logRef = useRef(onLog);
  const previewRef = useRef(onPreview);
  const finishRef = useRef(onFinish);
  useEffect(() => { logRef.current = onLog; previewRef.current = onPreview; finishRef.current = onFinish; }, [onLog, onPreview, onFinish]);

  useEffect(() => {
    const inflight = ensureInflight();
    if (inflight.has(key)) return;
    inflight.add(key);
    let aborted = false;
    (async () => {
      try {
        const res = await generateLessonCardsParallel({ courseId, lessonId, lessonTitle });
        if (aborted) return;
        for (const u of res.updates) {
          logRef.current(lessonId, u.text);
        }
        logRef.current(lessonId, res.count ? `カードを自動保存しました（${res.count} 件）` : "カードの保存に失敗しました");
      } catch (e: unknown) {
        const msg = (e as { message?: string })?.message ?? "unknown";
        if (!aborted) logRef.current(lessonId, `エラー: ${msg}`);
      } finally {
        // StrictMode の再マウントで早期に unmount されても完了時に親へ通知する
        finishRef.current();
        setTimeout(() => { ensureInflight().delete(key); }, 1500);
      }
    })();
    return () => {
      aborted = true;
      setTimeout(() => { ensureInflight().delete(key); }, 1500);
    };
  }, [lessonId, lessonTitle, courseId]);
  return null;
}
