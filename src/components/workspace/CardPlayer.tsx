"use client";
import * as React from "react";
import {
  snapshot as fetchSnapshot,
  saveProgress as saveProgressApi,
  rateSrs as rateSrsApi,
  listFlaggedByCourse,
  toggleFlag as toggleFlagApi,
  saveNote as saveNoteApi,
  getNote as getNoteApi,
} from "@/lib/client-api";
import type { UUID, Card, QuizCardContent, FillBlankCardContent, SrsRating, TextCardContent, Lesson, Progress } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QuizOption } from "@/components/player/QuizOption";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  courseId: UUID;
  selectedId?: UUID;
  selectedKind?: "lesson" | "card";
  onNavigate?: (nextCardId: UUID) => void;
};

export function CardPlayer({ courseId, selectedId, selectedKind, onNavigate }: Props) {
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
      const lessonIds = new Set<string>(snap.lessons.filter((l) => l.courseId === courseId).map((l) => l.id));
      const cs = snap.cards.filter((c) => lessonIds.has(c.lessonId)).sort((a, b) => a.orderIndex - b.orderIndex || a.createdAt.localeCompare(b.createdAt));
      setCards(cs);
      setProgress(snap.progress);
      const ids = await listFlaggedByCourse(courseId);
      if (!mounted) return;
      setFlagged(new Set(ids));
    })();
    return () => { mounted = false; };
  }, [courseId]);
  // セッション用の対象集合（nullなら全件）
  const [scopeIds, setScopeIds] = React.useState<string[] | null>(null);
  const flatCards = React.useMemo(() => cards, [cards]);
  const activeList = React.useMemo(() => (scopeIds ? flatCards.filter((c) => scopeIds.includes(c.id)) : flatCards), [flatCards, scopeIds]);
  const activeIndex = React.useMemo(() => activeList.findIndex((c) => c.id === selectedId), [activeList, selectedId]);
  const prevId = activeIndex > 0 ? (activeList[activeIndex - 1]?.id as UUID) : undefined;
  const nextId = activeIndex >= 0 && activeIndex < activeList.length - 1 ? (activeList[activeIndex + 1]?.id as UUID) : undefined;

  // セッション統計
  const [summaryOpen, setSummaryOpen] = React.useState(false);
  const cardStartRef = React.useRef<number>(Date.now());
  const [durations, setDurations] = React.useState<Record<string, number>>({});
  const [ratings, setRatings] = React.useState<Record<string, SrsRating | undefined>>({});
  const [results, setResults] = React.useState<Record<string, "correct" | "wrong">>({});
  const [flag, setFlag] = React.useState<boolean>(false);
  const [noteOpen, setNoteOpen] = React.useState(false);
  const [note, setNote] = React.useState<string>("");
  const [showHelp, setShowHelp] = React.useState(false);

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

  if (!selectedId || !card) {
    return <p className="text-sm text-gray-700">カードを選択すると、ここで学習できます。</p>;
  }

  return (
    <div className="p-2">
      {/* ヘッダー／カードメタ＋フラグ＋ノート */}
      <div className="mb-2">
        <span className="px-2 py-1 rounded bg-black/5 text-xs">{card.cardType}</span>
        {card.title ? <span className="ml-2 font-medium">{card.title}</span> : null}
        <div className="float-right flex items-center gap-2">
          <Button
            aria-label={flag ? "フラグ解除" : "フラグ"}
            onClick={async () => {
              const on = await toggleFlagApi(card.id);
              setFlag(on);
              setFlagged((s) => {
                const copy = new Set(s);
                if (on) copy.add(card.id); else copy.delete(card.id);
                return copy;
              });
            }}
            size="sm"
          >
            {flag ? "⭐" : "☆"}
          </Button>
          <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
            <DialogTrigger asChild>
              <Button size="sm" aria-label="ノート">📝</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>ノート</DialogTitle>
                <DialogDescription>このカードのメモを保存</DialogDescription>
              </DialogHeader>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="メモ…" />
              <div className="mt-3 flex justify-end">
                <Button onClick={async () => { await saveNoteApi(card.id, note); setNoteOpen(false); }} variant="default">保存</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button onClick={() => setShowHelp((s) => !s)} size="sm" aria-label="キーボードヘルプ">?</Button>
        </div>
      </div>

      {/* 進捗バー */}
      <div className="mt-2">
        <div className="h-1.5 w-full rounded bg-[hsl(var(--muted))]">
          <div className="h-full rounded bg-[hsl(var(--primary))]" style={{ width: `${activeList.length ? ((activeIndex + 1) / activeList.length) * 100 : 0}%` }} />
        </div>
        <p className="text-xs text-gray-600 mt-1">{activeIndex + 1} / {activeList.length}</p>
      </div>

      {showHelp && (
        <div className="p-3 text-sm mb-4 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
          <p className="font-medium mb-1">キーボードショートカット</p>
          <ul className="list-disc list-inside text-gray-700">
            <li>クイズ: 1–9 で選択, Enter で回答</li>
            <li>穴埋め: Enter で回答</li>
            <li>?: ヘルプの表示/非表示</li>
          </ul>
        </div>
      )}

      {/* 本文 */}
      {card.cardType === "text" && (
        <TextLearn content={card.content as TextCardContent} cardId={card.id} />
      )}
      {card.cardType === "quiz" && (
        <QuizLearn
          content={card.content as QuizCardContent}
          cardId={card.id}
          onResult={(r) => {
            const d = Date.now() - cardStartRef.current;
            setDurations((m) => ({ ...m, [card.id]: d }));
            setResults((m) => ({ ...m, [card.id]: r }));
          }}
          onRated={(rating) => setRatings((m) => ({ ...m, [card.id]: rating }))}
          gotoNext={() => { if (nextId && onNavigate) onNavigate(nextId); }}
        />
      )}
      {card.cardType === "fill-blank" && (
        <FillBlankLearn
          content={card.content as FillBlankCardContent}
          cardId={card.id}
          onResult={(r) => {
            const d = Date.now() - cardStartRef.current;
            setDurations((m) => ({ ...m, [card.id]: d }));
            setResults((m) => ({ ...m, [card.id]: r }));
          }}
          onRated={(rating) => setRatings((m) => ({ ...m, [card.id]: rating }))}
          gotoNext={() => { if (nextId && onNavigate) onNavigate(nextId); }}
        />
      )}

      <div className="mt-3 flex items-center justify-between">
        <div />
        <Button onClick={() => setSummaryOpen(true)} aria-label="セッションを終了">セッション終了</Button>
      </div>

      {/* 学習ビューと同様のナビゲーション */}
      <nav className="mt-6 flex items-center justify-between" aria-label="カードナビゲーション">
        <Button
          onClick={() => { if (prevId && onNavigate) onNavigate(prevId); }}
          disabled={!prevId}
          variant="outline"
          aria-label="前のカードへ"
        >
          前へ
        </Button>
        <div className="text-sm text-gray-600" aria-live="polite">{(progress.find((p) => p.cardId === card.id))?.completed ? "完了" : "未完了"}</div>
        <Button
          onClick={() => {
            if (nextId && onNavigate) {
              if (card.cardType === "text") {
                const input = { cardId: card.id, completed: true, completedAt: new Date().toISOString() } as Progress;
                void saveProgressApi(input).then(() => setProgress((arr) => {
                  const idx = arr.findIndex((p) => p.cardId === input.cardId);
                  if (idx === -1) return [...arr, input];
                  const copy = arr.slice(); copy[idx] = input; return copy;
                }));
              }
              onNavigate(nextId);
            }
          }}
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
            <li>正答: {Object.values(results).filter((v) => v === "correct").length}</li>
            <li>誤答: {Object.values(results).filter((v) => v === "wrong").length}</li>
            <li>Hard率: {(() => {
              const vals = Object.values(ratings).filter(Boolean) as SrsRating[];
              const hard = vals.filter((v) => v === "hard").length;
              return vals.length ? Math.round((hard / vals.length) * 100) : 0;
            })()}%</li>
            <li>平均反応時間: {(() => {
              const arr = Object.values(durations);
              if (!arr.length) return "-";
              const avg = Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
              return `${Math.round(avg / 100) / 10}s`;
            })()}</li>
          </ul>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button
              onClick={() => {
                const ids = Object.entries(results)
                  .filter(([, r]) => r === "wrong")
                  .map(([id]) => id);
                const arr = ids.length ? ids : null;
                setScopeIds(arr);
                if (arr && arr[0] && onNavigate) onNavigate(arr[0] as UUID);
                setSummaryOpen(false);
              }}
            >誤答のみ再演習</Button>
            <Button
              onClick={() => {
                const ids = Object.entries(ratings)
                  .filter(([, r]) => r === "hard")
                  .map(([id]) => id);
                const arr = ids.length ? ids : null;
                setScopeIds(arr);
                if (arr && arr[0] && onNavigate) onNavigate(arr[0] as UUID);
                setSummaryOpen(false);
              }}
            >Hardのみ再演習</Button>
            <Button
              onClick={async () => {
                const flagged = await listFlaggedByCourse(courseId);
                const arr = flagged.length ? flagged : null;
                setScopeIds(arr);
                if (arr && arr[0] && onNavigate) onNavigate(arr[0] as UUID);
                setSummaryOpen(false);
              }}
            >⭐ 要復習のみ再演習</Button>
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
                    correct: Object.values(results).filter((v) => v === "correct").length,
                    wrong: Object.values(results).filter((v) => v === "wrong").length,
                    hardRate: (() => {
                      const vals = Object.values(ratings).filter(Boolean) as SrsRating[];
                      const hard = vals.filter((v) => v === "hard").length;
                      return vals.length ? Math.round((hard / vals.length) * 100) : 0;
                    })(),
                    avgMs: (() => {
                      const arr = Object.values(durations);
                      if (!arr.length) return 0;
                      return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
                    })(),
                  },
                  durations,
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

function SrsPanel({ onSelect }: { onSelect: (r: SrsRating) => void }) {
  return (
    <div className="mt-4 grid grid-cols-4 gap-2">
      <Button onClick={() => onSelect("again")} className="w-full" variant="outline" aria-label="Again（もう一度）">Again</Button>
      <Button onClick={() => onSelect("hard")} className="w-full" variant="outline" aria-label="Hard（難しい）">Hard</Button>
      <Button onClick={() => onSelect("good")} className="w-full" variant="outline" aria-label="Good（良い）">Good</Button>
      <Button onClick={() => onSelect("easy")} className="w-full" variant="outline" aria-label="Easy（簡単）">Easy</Button>
    </div>
  );
}

function TextLearn({ content, cardId }: { content: TextCardContent; cardId: string }) {
  return (
    <div>
      <p className="whitespace-pre-wrap text-gray-800">{content.body}</p>
      <div className="mt-4">
        <Button onClick={() => {
          const input = { cardId, completed: true, completedAt: new Date().toISOString() } as Progress;
          void saveProgressApi(input);
        }}>完了</Button>
      </div>
    </div>
  );
}

function QuizLearn({ content, cardId, onResult, onRated, gotoNext }: { content: QuizCardContent; cardId: string; onResult?: (r: "correct" | "wrong") => void; onRated?: (r: SrsRating) => void; gotoNext?: () => void }) {
  const [selected, setSelected] = React.useState<number | null>(0);
  const [result, setResult] = React.useState<"idle" | "correct" | "wrong">("idle");
  const [revealed, setRevealed] = React.useState(false);

  function submit() {
    if (selected == null) return;
    const ok = selected === content.answerIndex;
    setResult(ok ? "correct" : "wrong");
    onResult?.(ok ? "correct" : "wrong");
    const input = { cardId, completed: ok, completedAt: ok ? new Date().toISOString() : undefined, answer: { selected } } as Progress;
    void saveProgressApi(input);
  }

  return (
    <div>
      <div className="font-medium text-gray-900">{content.question}</div>
      <div role="radiogroup" aria-label="選択肢" className="mt-2 space-y-2">
        {content.options.map((o, i) => (
          <QuizOption key={i} id={`opt-${i}`} label={o} checked={selected === i} onSelect={() => setSelected(i)} />
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button onClick={submit} variant="default" aria-label="採点する">Check</Button>
        <Button onClick={() => setRevealed((r) => !r)} variant="outline" aria-label="ヒントを表示">Hint</Button>
        <Button onClick={() => gotoNext?.()} variant="outline" aria-label="スキップ">Skip</Button>
        <span
          aria-live="polite"
          role="status"
          className={result === "correct" ? "text-green-600" : result === "wrong" ? "text-red-600" : "sr-only"}
        >
          {result === "correct" ? "正解！" : result === "wrong" ? "不正解" : ""}
        </span>
      </div>
      {(revealed || result !== "idle") && content.explanation && (
        <p className="mt-2 text-sm text-gray-700">{content.explanation}</p>
      )}
      {result !== "idle" && (
        <SrsPanel onSelect={(rating) => { onRated?.(rating); void rateSrsApi(cardId, rating); setTimeout(() => gotoNext?.(), 150); }} />
      )}
    </div>
  );
}

function FillBlankLearn({ content, cardId, onResult, onRated, gotoNext }: { content: FillBlankCardContent; cardId: string; onResult?: (r: "correct" | "wrong") => void; onRated?: (r: SrsRating) => void; gotoNext?: () => void }) {
  const indices = Array.from(content.text.matchAll(/\[\[(\d+)\]\]/g)).map((m) => m[1]);
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
    const input = { cardId, completed: ok, completedAt: ok ? new Date().toISOString() : undefined, answer: answers } as Progress;
    void saveProgressApi(input);
  }

  const parts = content.text.split(/(\[\[\d+\]\])/g);
  return (
    <div>
      <div className="text-gray-900">
        {parts.map((part, i) => {
          const m = part.match(/^\[\[(\d+)\]\]$/);
          if (!m) return <span key={i}>{part}</span>;
          const k = m[1];
          return (
            <Input key={i} className="w-24 mx-1 inline-flex" placeholder={`#${k}`} value={answers[k] ?? ""} onChange={(e) => setAnswers((s) => ({ ...s, [k]: e.target.value }))} />
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button onClick={check} variant="default">Check</Button>
        <Button onClick={() => gotoNext?.()} variant="outline" aria-label="スキップ">Skip</Button>
        <span
          aria-live="polite"
          role="status"
          className={result === "correct" ? "text-green-600" : result === "wrong" ? "text-red-600" : "sr-only"}
        >
          {result === "correct" ? "正解！" : result === "wrong" ? "不正解" : ""}
        </span>
      </div>
      {result !== "idle" && (
        <SrsPanel onSelect={(rating) => { onRated?.(rating); void rateSrsApi(cardId, rating); setTimeout(() => gotoNext?.(), 150); }} />
      )}
    </div>
  );
}
