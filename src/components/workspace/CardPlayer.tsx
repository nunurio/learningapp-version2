"use client";
import * as React from "react";
import {
  snapshot as fetchSnapshot,
  saveProgress as saveProgressApi,
  listFlaggedByCourse,
  toggleFlag as toggleFlagApi,
  saveNote as saveNoteApi,
  getNote as getNoteApi,
} from "@/lib/client-api";
import type { UUID, Card, QuizCardContent, FillBlankCardContent, SrsRating, TextCardContent, Progress } from "@/lib/types";
import type { SaveCardDraftInput } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { QuizOption } from "@/components/player/QuizOption";
import { QuizHintCard, QuizSolutionPanel } from "@/components/player/QuizSolutionPanel";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import MarkdownView from "@/components/markdown/MarkdownView";
import { useWorkspaceSelector, workspaceStore } from "@/lib/state/workspace-store";
import { Star, StickyNote, HelpCircle } from "lucide-react";
import { normalizeFillBlankText } from "@/lib/utils/fill-blank";
import { publishActiveRef } from "@/components/ai/active-ref";

type Props = {
  courseId: UUID;
  selectedId?: UUID;
  selectedKind?: "lesson" | "card";
  onNavigate?: (nextCardId: UUID) => void;
  /**
   * If provided, limits the active list to cards within this lesson.
   * This reflects user intent when選択したレッスン行から学習/生成を開始した場合の“レッスンスコープ”。
   * Local session scopes (e.g., flagged-only) still override this.
   */
  lessonScopeId?: UUID;
};

export function CardPlayer({ courseId, selectedId, selectedKind, onNavigate, lessonScopeId }: Props) {
  const version = useWorkspaceSelector((s) => s.version);
  const draftForSelected = useWorkspaceSelector((s) => (selectedId ? s.drafts[selectedId] : undefined), (a, b) => JSON.stringify(a) === JSON.stringify(b));
  const [cards, setCards] = React.useState<Card[]>([]);
  const [progress, setProgress] = React.useState<Progress[]>([]);
  const [flagged, setFlagged] = React.useState<Set<UUID>>(new Set());
  const [card, setCard] = React.useState<Card | null>(null);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const snap = await fetchSnapshot();
      if (!mounted) return;
      // keep only cards for lessons in this course
      const lessonsInCourse = snap.lessons.filter((l) => l.courseId === courseId);
      const lessonIds = new Set<string>(lessonsInCourse.map((l) => l.id));
      const lessonOrder = new Map<string, number>(lessonsInCourse.map((l) => [l.id, l.orderIndex] as const));
      const cs = snap.cards
        .filter((c) => lessonIds.has(c.lessonId))
        // Stable course-wide ordering: lesson.orderIndex -> card.orderIndex -> createdAt
        .sort((a, b) => {
          const la = lessonOrder.get(a.lessonId) ?? 0;
          const lb = lessonOrder.get(b.lessonId) ?? 0;
          return (
            (la - lb) ||
            (a.orderIndex - b.orderIndex) ||
            a.createdAt.localeCompare(b.createdAt)
          );
        });
      setCards(cs);
      setProgress(snap.progress);
      const ids = await listFlaggedByCourse(courseId);
      if (!mounted) return;
      setFlagged(new Set(ids));
    })();
    return () => { mounted = false; };
  }, [courseId, version]);
  // セッション用の対象集合（nullなら全件）
  const [scopeIds, setScopeIds] = React.useState<string[] | null>(null);
  const flatCards = React.useMemo(() => cards, [cards]);
  // lessonScopeId (from parent) provides a default scoping, unless user set a manual scope locally
  const activeList = React.useMemo(() => {
    if (scopeIds) return flatCards.filter((c) => scopeIds.includes(c.id)); // manual override (e.g., flagged-only)
    if (lessonScopeId) return flatCards.filter((c) => c.lessonId === lessonScopeId);
    return flatCards;
  }, [flatCards, scopeIds, lessonScopeId]);
  const activeIndex = React.useMemo(() => activeList.findIndex((c) => c.id === selectedId), [activeList, selectedId]);
  const prevId = activeIndex > 0 ? (activeList[activeIndex - 1]?.id as UUID) : undefined;
  const nextId = activeIndex >= 0 && activeIndex < activeList.length - 1 ? (activeList[activeIndex + 1]?.id as UUID) : undefined;

  // セッション統計
  const [summaryOpen, setSummaryOpen] = React.useState(false);
  const cardStartRef = React.useRef<number>(Date.now());
  const [durations, setDurations] = React.useState<Record<string, number>>({});
  const [ratings, setRatings] = React.useState<Record<string, SrsRating | undefined>>({});
  const [results, setResults] = React.useState<Record<string, "correct" | "wrong">>({});
  // このセッションで確定した「理解度」(1-5)。サマリーと再演習の基準。
  const [levels, setLevels] = React.useState<Record<string, number | undefined>>({});
  const [flag, setFlag] = React.useState<boolean>(false);
  const [noteOpen, setNoteOpen] = React.useState(false);
  const [note, setNote] = React.useState<string>("");
  const [showHelp, setShowHelp] = React.useState(false);

  // 進捗ローカル更新 + 永続化のヘルパ
  // 同一 cardId への保存は直列化してサーバーの最終状態逆転を防ぐ
  const saveQueueRef = React.useRef<Map<UUID, Promise<void>>>(new Map());
  const saveAndSetProgress = React.useCallback((input: Progress) => {
    // 1) 楽観的にローカル state を即時更新（最新の入力が UI に残る）
    setProgress((arr) => {
      const idx = arr.findIndex((p) => p.cardId === input.cardId);
      if (idx === -1) return [...arr, input];
      const copy = arr.slice();
      // answer はマージ（level/selected 等を保持）
      const prev = copy[idx];
      copy[idx] = {
        ...prev,
        ...input,
        answer:
          typeof prev?.answer === "object" && prev?.answer
            ? { ...(prev.answer as Record<string, unknown>), ...(input.answer as Record<string, unknown> | undefined) }
            : input.answer,
      } as Progress;
      return copy;
    });

    // 2) カード単位で保存を直列化（先に投げた保存が遅延で上書きしないように）
    const key = input.cardId as UUID;
    const prev = saveQueueRef.current.get(key) ?? Promise.resolve();
    const next = prev
      .catch((e) => {
        // 直列化維持のため握りつぶして次へ（エラーは個別に記録）
        console.error("saveProgress queue previous failed:", e);
      })
      .then(async () => {
        try {
          await saveProgressApi(input);
        } catch (e) {
          console.error("saveProgress failed:", e);
          // TODO: トーストなどでユーザー通知するならここ
        }
      });
    saveQueueRef.current.set(key, next);

    // 3) 理解度スライダー確定時（answer.level がある）に SRS を評価して更新
    try {
      const level = getLevelFromAnswer(input.answer);
      if (typeof level === "number") {
        // セッション内レベル確定
        setLevels((m) => ({ ...m, [input.cardId]: level }));
        // レベル→SRS レーティングへ変換し保存（学習スケジュール更新）
        const rating: SrsRating = level <= 1 ? "again" : level === 2 ? "hard" : level === 5 ? "easy" : "good";
        setRatings((m) => ({ ...m, [input.cardId]: rating }));
        // 動的 import ＆ 存在チェックでモック未定義環境（テスト）でも安全に呼び出す
        void import("@/lib/client-api")
          .then((m) => {
            if (
              "rateSrs" in m &&
              typeof (m as unknown as { rateSrs?: (id: UUID, r: SrsRating) => Promise<unknown> }).rateSrs === "function"
            ) {
              return (m as unknown as { rateSrs: (id: UUID, r: SrsRating) => Promise<unknown> }).rateSrs(
                input.cardId as UUID,
                rating
              );
            }
            return undefined;
          })
          .catch((e) => {
            console.error("rateSrs failed:", e);
          });
      }
    } catch (e) {
      console.error("SRS rating update failed:", e);
    }
  }, []);

  React.useEffect(() => {
    if (!selectedId) { setCard(null); return; }
    if (selectedKind === "card") {
      const found = flatCards.find((c) => c.id === selectedId) ?? null;
      setCard(found);
      // カード切り替え→計測開始＆フラグ/ノート同期
      cardStartRef.current = Date.now();
      setFlag(flagged.has(selectedId));
      (async () => setNote((await getNoteApi(selectedId)) ?? ""))();
    } else {
      setCard(null);
    }
  }, [courseId, selectedId, selectedKind, flatCards, flagged]);

  // Draft overlay: create a view-model merged with transient edits
  const draft: SaveCardDraftInput | undefined =
    draftForSelected && card && (draftForSelected as SaveCardDraftInput).cardId === card.id
      ? (draftForSelected as SaveCardDraftInput)
      : undefined;
  const view = React.useMemo<Card | null>(() => {
    if (!card) return null;
    if (!draft) return card;
    const base: Card = { ...card };
    // common fields
    base.title = draft.title ?? base.title ?? null;
    base.tags = draft.tags ?? base.tags;
    if (draft.cardType === "text" && base.cardType === "text") {
      base.content = { body: draft.body } as TextCardContent;
    } else if (draft.cardType === "quiz" && base.cardType === "quiz") {
      const baseContent = base.content as QuizCardContent;
      base.content = {
        question: draft.question ?? baseContent.question,
        options: draft.options ?? baseContent.options,
        answerIndex: draft.answerIndex ?? baseContent.answerIndex,
        explanation:
          draft.explanation !== undefined ? draft.explanation : baseContent.explanation,
        optionExplanations:
          draft.optionExplanations !== undefined
            ? draft.optionExplanations
            : baseContent.optionExplanations,
        hint: draft.hint !== undefined ? draft.hint : baseContent.hint,
      } satisfies QuizCardContent;
    } else if (draft.cardType === "fill-blank" && base.cardType === "fill-blank") {
      base.content = {
        text: draft.text,
        answers: draft.answers,
        caseSensitive: !!draft.caseSensitive,
      } as FillBlankCardContent;
    }
    return base;
  }, [card, draft]);

  React.useEffect(() => {
    if (!view) {
      publishActiveRef({ courseId, mode: "workspace" });
      return;
    }
    publishActiveRef({
      courseId,
      lessonId: view.lessonId,
      cardId: view.id,
      mode: "workspace",
    });
  }, [courseId, view]);

  if (!selectedId || !view) {
    return <p className="text-sm text-gray-700">カードを選択すると、ここで学習できます。</p>;
  }

  return (
    <div className="p-2">
      {/* ヘッダー／カードメタ＋フラグ＋ノート */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center">
          <span className="px-2 py-1 rounded bg-black/5 text-xs">{view.cardType}</span>
          {view.title ? <span className="ml-2 font-medium">{view.title}</span> : null}
        </div>
        <div className="flex items-center gap-1">
          <Button
            aria-label={flag ? "フラグ解除" : "フラグ"}
            onClick={async () => {
              const on = await toggleFlagApi(view.id);
              setFlag(on);
              setFlagged((s) => {
                const copy = new Set(s);
                if (on) copy.add(view.id); else copy.delete(view.id);
                return copy;
              });
            }}
            size="icon"
            variant="ghost"
            className="h-8 w-8"
          >
            <Star className={flag ? "h-4 w-4 fill-current text-yellow-500" : "h-4 w-4"} />
          </Button>
          <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
            <DialogTrigger asChild>
              <Button size="icon" variant="ghost" aria-label="ノート" className="h-8 w-8">
                {/* メモが存在する場合は目立つ色で塗りつぶし */}
                <StickyNote className={note && note.trim().length > 0 ? "h-4 w-4 fill-current text-sky-500" : "h-4 w-4"} />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>ノート</DialogTitle>
                <DialogDescription>このカードのメモを保存</DialogDescription>
              </DialogHeader>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="メモ…" />
              <div className="mt-3 flex justify-end">
                <Button onClick={async () => { await saveNoteApi(view.id, note); setNoteOpen(false); }} variant="default">保存</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button onClick={() => setShowHelp((s) => !s)} size="icon" variant="ghost" aria-label="キーボードヘルプ" className="h-8 w-8">
            <HelpCircle className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 進捗バー */}
      <div className="mb-4">
        <div className="h-1.5 w-full rounded bg-[hsl(var(--muted))]">
          <div className="h-full rounded bg-[hsl(var(--primary))]" style={{ width: `${activeList.length ? ((activeIndex + 1) / activeList.length) * 100 : 0}%` }} />
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-gray-600">
            {activeIndex + 1} / {activeList.length}
          </span>
          <span className="text-xs text-gray-600">
            理解度: {(() => {
              const cur = progress.find((p) => p.cardId === view.id);
              const level = getLevelFromAnswer(cur?.answer);
              return level != null ? `${level}/5` : "未評価";
            })()}
          </span>
        </div>
      </div>

      {showHelp && (
        <div className="p-3 text-sm mb-4 rounded-md border border-[hsl(220_13%_85%_/_0.6)] bg-[hsl(var(--card))] shadow-sm">
          <p className="font-medium mb-1">キーボードショートカット</p>
          <ul className="list-disc list-inside text-gray-700">
            <li>クイズ: 1–9 で選択, Enter で回答</li>
            <li>穴埋め: Enter で回答</li>
            <li>?: ヘルプの表示/非表示</li>
          </ul>
        </div>
      )}

      {/* 本文 */}
      {view.cardType === "text" && (
        <TextLearn
          content={view.content as TextCardContent}
          cardId={view.id}
          initialLevel={getLevelFromAnswer(progress.find((p) => p.cardId === view.id)?.answer)}
          onSave={saveAndSetProgress}
        />
      )}
      {view.cardType === "quiz" && (
        <QuizLearn
          content={view.content as QuizCardContent}
          cardId={view.id}
          initialLevel={getLevelFromAnswer(progress.find((p) => p.cardId === view.id)?.answer)}
          onResult={(r) => {
            const d = Date.now() - cardStartRef.current;
            setDurations((m) => ({ ...m, [view.id]: d }));
            setResults((m) => ({ ...m, [view.id]: r }));
          }}
          onSave={saveAndSetProgress}
          gotoNext={() => { if (nextId && onNavigate) onNavigate(nextId); }}
        />
      )}
      {view.cardType === "fill-blank" && (
        <FillBlankLearn
          content={view.content as FillBlankCardContent}
          cardId={view.id}
          initialLevel={getLevelFromAnswer(progress.find((p) => p.cardId === view.id)?.answer)}
          onResult={(r) => {
            const d = Date.now() - cardStartRef.current;
            setDurations((m) => ({ ...m, [view.id]: d }));
            setResults((m) => ({ ...m, [view.id]: r }));
          }}
          onSave={saveAndSetProgress}
          gotoNext={() => { if (nextId && onNavigate) onNavigate(nextId); }}
        />
      )}

      {/* ナビゲーション */}
      <nav className="mt-6 flex items-center justify-between" aria-label="カードナビゲーション">
        <Button
          onClick={() => { if (prevId && onNavigate) onNavigate(prevId); }}
          disabled={!prevId}
          variant="outline"
          aria-label="前のカードへ"
        >
          前へ
        </Button>
        <Button 
          onClick={() => setSummaryOpen(true)} 
          variant="ghost" 
          size="sm"
          aria-label="セッションを終了"
        >
          セッション終了
        </Button>
        <Button
          onClick={() => { if (nextId && onNavigate) onNavigate(nextId); }}
          disabled={!nextId}
          variant="outline"
          aria-label="次のカードへ"
        >
          次へ
        </Button>
      </nav>

      {/* セッションまとめ */}
      <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>セッションまとめ</DialogTitle>
            <DialogDescription>このセッションの学習結果</DialogDescription>
          </DialogHeader>
          <ul className="grid grid-cols-2 gap-2 text-sm">
            <li>完了(≧3): {Object.values(levels).filter((v) => typeof v === "number" && (v as number) >= 3).length}</li>
            <li>未達(≦2): {Object.values(levels).filter((v) => typeof v === "number" && (v as number) <= 2).length}</li>
            <li>平均理解度: {(() => {
              const arr = Object.values(levels).filter((v): v is number => typeof v === "number");
              if (!arr.length) return "-";
              const avg = Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10;
              return `${avg}/5`;
            })()}</li>
            <li>平均反応時間: {(() => {
              const arr = Object.values(durations);
              if (!arr.length) return "-";
              const avg = Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
              return `${Math.round(avg / 100) / 10}s`;
            })()}</li>
            <li className="col-span-2">分布: {(() => {
              const dist = [1,2,3,4,5].map((lv) => Object.values(levels).filter((v) => v === lv).length);
              return dist.map((c, i) => `${i+1}:${c}`).join(" / ");
            })()}</li>
          </ul>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button
              onClick={() => {
                const ids = Object.entries(levels)
                  .filter(([, lv]) => typeof lv === "number" && (lv as number) <= 2)
                  .map(([id]) => id);
                const arr = ids.length ? ids : null;
                setScopeIds(arr);
                if (arr && arr[0] && onNavigate) onNavigate(arr[0] as UUID);
                setSummaryOpen(false);
              }}
            >低理解度(≦2)のみ再演習</Button>
            <Button
              onClick={() => {
                // 現在のアクティブ集合から未評価（levels未登録）のみを抽出
                const ids = activeList
                  .map((c) => c.id)
                  .filter((id) => levels[id] == null);
                const arr = ids.length ? ids : null;
                setScopeIds(arr);
                if (arr && arr[0] && onNavigate) onNavigate(arr[0] as UUID);
                setSummaryOpen(false);
              }}
            >未評価のみ再演習</Button>
            <Button
              onClick={async () => {
                const flagged = await listFlaggedByCourse(courseId);
                const arr = flagged.length ? flagged : null;
                setScopeIds(arr);
                if (arr && arr[0] && onNavigate) onNavigate(arr[0] as UUID);
                setSummaryOpen(false);
              }}
            >
              <Star className="h-4 w-4 fill-current mr-1" />
              要復習のみ再演習
            </Button>
            <Button
              onClick={() => {
                setScopeIds(flatCards.map((c) => c.id));
                if (flatCards[0] && onNavigate) onNavigate(flatCards[0].id as UUID);
                setSummaryOpen(false);
              }}
            >全件からやり直す</Button>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => {
                const payload = {
                  courseId,
                  at: new Date().toISOString(),
                  stats: {
                    done: Object.values(levels).filter((v) => typeof v === "number" && (v as number) >= 3).length,
                    pending: Object.values(levels).filter((v) => typeof v === "number" && (v as number) <= 2).length,
                    avgLevel: (() => {
                      const arr = Object.values(levels).filter((v): v is number => typeof v === "number");
                      return arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0;
                    })(),
                    avgMs: (() => {
                      const arr = Object.values(durations);
                      if (!arr.length) return 0;
                      return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
                    })(),
                  },
                  durations,
                  levels,
                  results,
                  ratings,
                };
                const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `learnify-session-${courseId}-${Date.now()}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >JSONエクスポート</Button>
            <Button onClick={() => setSummaryOpen(false)} variant="default">閉じる</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// 理解度スライダー（1–5）。3以上で完了ライン。
function UnderstandingSlider({
  cardId,
  initial,
  onSave,
  extraAnswer,
}: {
  cardId: string;
  initial?: number;
  onSave: (p: Progress) => void;
  extraAnswer?: Record<string, unknown>;
}) {
  const [lv, setLv] = React.useState<number>(initial ?? 0);
  // Reset local state when switching cards or when initial level changes
  React.useEffect(() => {
    setLv(initial ?? 0);
    // Sync transient level to workspace store for realtime UI (NavTree rings)
    const normalized = typeof initial === "number" && initial > 0 ? initial : undefined;
    workspaceStore.setLevel(cardId as UUID, normalized);
  }, [cardId, initial]);
  const completed = lv >= 3;
  const color = React.useMemo(() => {
    if (!lv || lv <= 0) return undefined;
    if (lv <= 2) return "hsl(var(--destructive))";
    if (lv === 3) return "hsl(var(--warning-600))";
    return "hsl(var(--success-600))"; // 4–5
  }, [lv]);
  const labelClass = React.useMemo(() => {
    if (!lv || lv <= 0) return "text-gray-500 text-sm";
    if (lv <= 2) return "text-[hsl(var(--destructive))] text-sm";
    if (lv === 3) return "text-[hsl(var(--warning-600))] text-sm";
    return "text-[hsl(var(--success-600))] text-sm";
  }, [lv]);
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-700">理解度 {lv > 0 ? `${lv}/5` : "未評価"}</span>
        <span className={labelClass}>{completed ? `完了 / 理解度 ${lv}/5` : "3以上で完了"}</span>
      </div>
      <Slider
        min={1}
        max={5}
        step={1}
        color={color}
        value={lv ? [lv] : [1]}
        onValueChange={(v) => {
          const next = v[0] ?? 1;
          setLv(next);
          // Realtime: reflect level to left NavTree rings immediately
          workspaceStore.setLevel(cardId as UUID, next);
        }}
        onValueCommit={(v) => {
          const next = v[0] ?? 1;
          const payload: Progress = {
            cardId,
            completed: next >= 3,
            completedAt: next >= 3 ? new Date().toISOString() : undefined,
            answer: { ...(extraAnswer ?? {}), level: next },
          };
          onSave(payload);
        }}
        aria-label="理解度"
      />
      <div className="mt-1 flex justify-between text-[10px] text-gray-500">
        <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
      </div>
    </div>
  );
}

function TextLearn({ content, cardId, initialLevel, onSave }: { content: TextCardContent; cardId: string; initialLevel?: number; onSave: (p: Progress) => void }) {
  return (
    <div>
      {/* Markdown 表示（安全サニタイズ済み） */}
      <MarkdownView markdown={content.body ?? ""} />
      <UnderstandingSlider cardId={cardId} initial={initialLevel} onSave={onSave} />
    </div>
  );
}

function QuizLearn({ content, cardId, initialLevel, onResult, onSave, gotoNext }: { content: QuizCardContent; cardId: string; initialLevel?: number; onResult?: (r: "correct" | "wrong") => void; onSave: (p: Progress) => void; gotoNext?: () => void }) {
  const [selected, setSelected] = React.useState<number | null>(0);
  const [result, setResult] = React.useState<"idle" | "correct" | "wrong">("idle");
  const [showHint, setShowHint] = React.useState(false);

  React.useEffect(() => { setShowHint(false); }, [cardId]);
  const hasHint = typeof content.hint === "string";

  function submit() {
    if (selected == null) return;
    const ok = selected === content.answerIndex;
    setResult(ok ? "correct" : "wrong");
    onResult?.(ok ? "correct" : "wrong");
    // 採点時点では完了にしない（理解度スライダーで確定）
    const input = { cardId, completed: false, answer: { selected, result: ok ? "correct" : "wrong" } } as Progress;
    onSave(input);
  }

  return (
    <div>
      <MarkdownView
        markdown={content.question ?? ""}
        className="markdown-body text-base font-medium text-gray-900"
      />
      <div role="radiogroup" aria-label="選択肢" className="mt-2 space-y-2">
        {content.options.map((o, i) => (
          <QuizOption key={i} id={`opt-${i}`} label={o} checked={selected === i} onSelect={() => setSelected(i)} />
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button onClick={submit} variant="default" aria-label="採点する">Check</Button>
        <Button
          onClick={() => setShowHint((r) => !r)}
          variant="outline"
          aria-label="ヒントを表示"
          aria-pressed={showHint && hasHint}
        >
          {showHint && hasHint ? "ヒントを隠す" : "Hint"}
        </Button>
        <span
          aria-live="polite"
          role="status"
          className={result === "correct" ? "text-green-600" : result === "wrong" ? "text-red-600" : "sr-only"}
        >
          {result === "correct" ? "正解！" : result === "wrong" ? "不正解" : ""}
        </span>
      </div>
      <QuizHintCard hint={content.hint ?? undefined} visible={showHint} />
      <QuizSolutionPanel content={content} selected={selected} visible={result !== "idle"} />
      {result !== "idle" && (
        <UnderstandingSlider
          cardId={cardId}
          initial={initialLevel}
          onSave={(p) => { onSave(p); }}
          extraAnswer={{ selected: selected ?? undefined, result }}
        />
      )}
    </div>
  );
}

function FillBlankLearn({ content, cardId, initialLevel, onResult, onSave, gotoNext }: { content: FillBlankCardContent; cardId: string; initialLevel?: number; onResult?: (r: "correct" | "wrong") => void; onSave: (p: Progress) => void; gotoNext?: () => void }) {
  const normalized = React.useMemo(() => normalizeFillBlankText(content.text), [content.text]);
  const indices = React.useMemo(() => Array.from(normalized.matchAll(/\[\[(\d+)\]\]/g)).map((m) => m[1]), [normalized]);
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [result, setResult] = React.useState<"idle" | "correct" | "wrong">("idle");

  function check() {
    const ok = indices.every((k) => {
      const a = (answers[k] ?? "").trim();
      const expect = content.answers[k]?.trim() ?? "";
      if (!content.caseSensitive) return a.toLowerCase() === expect.toLowerCase();
      return a === expect;
    });
    setResult(ok ? "correct" : "wrong");
    onResult?.(ok ? "correct" : "wrong");
    // 採点時点では完了にしない（理解度スライダーで確定）
    const input = { cardId, completed: false, answer: { ...answers, result: ok ? "correct" : "wrong" } } as Progress;
    onSave(input);
  }

  const parts = React.useMemo(() => normalized.split(/(\[\[\d+\]\])/g), [normalized]);
  const placeholderPattern = /^\[\[(\d+)\]\]$/;
  return (
    <div>
      <div className="text-gray-900 text-base leading-relaxed">
        {parts.map((part, i) => {
          const m = part.match(placeholderPattern);
          if (!m) {
            if (!part) return null;
            if (!part.trim()) {
              return <span key={`space-${i}`} aria-hidden="true"> </span>;
            }
            return (
              <MarkdownView
                key={`text-${i}`}
                markdown={part}
                variant="inline"
              />
            );
          }
          const k = m[1];
          return (
            <span key={`blank-${i}`} className="inline-flex items-center align-middle mx-1">
              <Input
                className="inline-flex w-24"
                placeholder={`#${k}`}
                value={answers[k] ?? ""}
                onChange={(e) => setAnswers((s) => ({ ...s, [k]: e.target.value }))}
              />
            </span>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button onClick={check} variant="default">Check</Button>
        <span
          aria-live="polite"
          role="status"
          className={result === "correct" ? "text-green-600" : result === "wrong" ? "text-red-600" : "sr-only"}
        >
          {result === "correct" ? "正解！" : result === "wrong" ? "不正解" : ""}
        </span>
      </div>
      {result !== "idle" && (
        <UnderstandingSlider
          cardId={cardId}
          initial={initialLevel}
          onSave={(p) => { onSave(p); }}
          extraAnswer={{ ...answers, result }}
        />
      )}
    </div>
  );
}

// answer から level を抽出（text/quiz/fill-blank 共通）
function getLevelFromAnswer(answer?: unknown): number | undefined {
  if (!answer || typeof answer !== "object") return undefined;
  const a = answer as Record<string, unknown>;
  const v = a["level"];
  return typeof v === "number" ? v : undefined;
}
