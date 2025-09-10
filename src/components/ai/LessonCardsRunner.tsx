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
  // dev StrictMode の副作用による二重起動を抑止する軽量ガード
  const key = `${lessonId}-batch`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g: any = globalThis as any;
  if (!g.__ai_inflight) g.__ai_inflight = new Set<string>();
  const logRef = useRef(onLog);
  const previewRef = useRef(onPreview);
  const finishRef = useRef(onFinish);
  useEffect(() => { logRef.current = onLog; previewRef.current = onPreview; finishRef.current = onFinish; }, [onLog, onPreview, onFinish]);

  useEffect(() => {
    if (g.__ai_inflight.has(key)) return;
    g.__ai_inflight.add(key);
    let aborted = false;
    (async () => {
      try {
        logRef.current(lessonId, "received");
        // 1) プランニング（枚数・順番・タイプ・概要）
        logRef.current(lessonId, "planCards");
        const planRes = await fetch("/api/ai/lesson-cards/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lessonTitle, courseId }),
          cache: "no-store",
        });
        if (!planRes.ok) throw new Error(`HTTP ${planRes.status}`);
        const planJson = (await planRes.json()) as { plan: { lessonTitle: string; count: number; sharedPrefix?: string | null; cards: { type: "text" | "quiz" | "fill-blank"; brief: string; title?: string | null }[] } };
        if (aborted) return;
        const total = planJson.plan.count ?? planJson.plan.cards.length;
        logRef.current(lessonId, `planReady(${total})`);

        // 2) 単体生成を並列実行（順序は計画順を保持）
        // 生成スロットは "未確定" を許す配列で管理し、完了後に厳密型へ収束させる
        const slots = Array.from<LessonCards["cards"][number] | undefined>({ length: total });
        const concurrency = Math.max(1, Number(process.env.NEXT_PUBLIC_AI_CONCURRENCY ?? 10));
        let nextIndex = 0;
        let completed = 0;

        function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

        async function generateWithRetry(i: number, item: { type: "text" | "quiz" | "fill-blank"; brief: string; title?: string | null }) {
          const maxAttempts = 3;
          let lastError: unknown = null;
          for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            if (aborted) return;
            try {
              const genRes = await fetch("/api/ai/lesson-cards", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  lessonTitle,
                  desiredCount: 1,
                  courseId,
                  desiredCardType: item.type,
                  userBrief: item.brief,
                  sharedPrefix: planJson.plan.sharedPrefix ?? undefined,
                }),
                cache: "no-store",
              });
              if (!genRes.ok) throw new Error(`HTTP ${genRes.status}`);
              const gen = (await genRes.json()) as { payload: LessonCards };
              if (aborted) return;
              const card = gen.payload.cards[0];
              if (item.title && "title" in card) {
                (card as { title?: string | null }).title = item.title;
              }
              slots[i] = card;
              return;
            } catch (e: unknown) {
              lastError = e;
              if (attempt < maxAttempts) {
                // 軽い指数バックオフ（+ジッター）
                const base = 250 * Math.pow(2, attempt - 1);
                const jitter = Math.floor(Math.random() * 120);
                logRef.current(lessonId, `retry ${attempt + 1}/3 for #${i + 1}`);
                await sleep(base + jitter);
                continue;
              }
              break;
            }
          }
          // すべて失敗: プレースホルダを格納
          const msg = (lastError as { message?: string } | undefined)?.message ?? "unknown";
          slots[i] = { type: "text", title: item.title ?? null, body: `生成に失敗しました: ${msg}` } as LessonCards["cards"][number];
          throw lastError ?? new Error("single-card generation failed");
        }

        async function worker() {
          while (!aborted) {
            const i = nextIndex++;
            if (i >= total) break;
            const item = planJson.plan.cards[i];
            try {
              await generateWithRetry(i, item);
              completed += 1;
              logRef.current(lessonId, `generateCard ${completed}/${total}`);
            } catch (e: unknown) {
              completed += 1;
              logRef.current(lessonId, `generateCard ${completed}/${total} (fallback)`);
            }
          }
        }

        const workers = Array.from({ length: concurrency }).map(() => worker());
        await Promise.all(workers);
        if (aborted) return;

        // 未確定が残っていればプレースホルダで埋める（理論上ここには来ない想定）
        const cards = slots.map((c, i) =>
          c ?? ({ type: "text", title: null, body: `未生成スロット ${i + 1}` } as LessonCards["cards"][number])
        );
        const payload: LessonCards = { lessonTitle, cards };
        const draft = await saveDraft("lesson-cards", payload);
        if (aborted) return;
        logRef.current(lessonId, "persistPreview");
        const committed = await commitLessonCards({ draftId: draft.id, lessonId });
        if (aborted) return;
        logRef.current(
          lessonId,
          committed ? `カードを自動保存しました（${committed.count} 件）` : "カードの保存に失敗しました"
        );
      } catch (e: unknown) {
        const msg = (e as { message?: string })?.message ?? "unknown";
        if (!aborted) logRef.current(lessonId, `エラー: ${msg}`);
      } finally {
        if (!aborted) finishRef.current();
        // StrictMode の初回/再マウントを吸収するため少し遅らせて解除
        setTimeout(() => { g.__ai_inflight.delete(key); }, 1500);
      }
    })();
    return () => {
      aborted = true;
      setTimeout(() => { g.__ai_inflight.delete(key); }, 1500);
    };
  }, [lessonId, lessonTitle, courseId]);
  return null;
}
