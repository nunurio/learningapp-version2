"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  getCourse,
  listLessons,
  listCards,
  getProgress,
  saveProgress,
} from "@/lib/localdb";
import type {
  Card,
  Course,
  FillBlankCardContent,
  Lesson,
  QuizCardContent,
  TextCardContent,
} from "@/lib/types";
import { Header } from "@/components/ui/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useHotkeys } from "@/components/hooks/useHotkeys";
import { QuizOption } from "@/components/player/QuizOption";
import { rateSrs } from "@/lib/localdb";
import type { SrsRating } from "@/lib/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { isFlagged, toggleFlag, saveNote, getNote } from "@/lib/localdb";

export default function LearnCoursePage() {
  const params = useParams<{ courseId: string }>();
  const courseId = params.courseId;
  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [replay, setReplay] = useState<string[] | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const c = getCourse(courseId) ?? null;
    setCourse(c);
    const ls = listLessons(courseId);
    setLessons(ls);
    const all = ls.flatMap((l) => listCards(l.id));
    setCards(all);
  }, [courseId]);

  const [idx, setIdx] = useState(0);
  const activeCards = replay ? cards.filter((c) => replay.includes(c.id)) : cards;
  const current = activeCards[idx];
  const total = activeCards.length;
  const [summaryOpen, setSummaryOpen] = useState(false);
  const cardStartRef = useRef<number>(Date.now());
  const [durations, setDurations] = useState<Record<string, number>>({});
  const [ratings, setRatings] = useState<Record<string, SrsRating | undefined>>({});
  const [results, setResults] = useState<Record<string, "correct" | "wrong">>({});

  function goto(i: number) {
    setIdx(Math.max(0, Math.min(total - 1, i)));
  }

  useHotkeys(
    {
      "?": () => setShowHelp((s) => !s),
      ArrowLeft: () => goto(idx - 1),
      ArrowRight: () => goto(idx + 1),
      s: () => goto(idx + 1), // Skip
    },
    [idx, total]
  );

  useEffect(() => {
    cardStartRef.current = Date.now();
  }, [idx]);

  // Reset index when replay set changes
  useEffect(() => {
    setIdx(0);
  }, [replay]);

  if (!course) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <p className="text-sm text-gray-600">コースが見つかりませんでした。</p>
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="min-h-screen">
        <Header minimal />
        <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">{course.title} を学習</h1>
            <Button asChild><Link href={`/courses/${course.id}`}>戻る</Link></Button>
          </div>
          <p className="mt-4 text-sm text-gray-600">カードがありません。コース編集画面から追加してください。</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header minimal />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <header className="mb-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">{course.title} を学習</h1>
            <div className="flex items-center gap-2">
              <Button onClick={() => setShowHelp((s) => !s)} aria-label="キーボードヘルプ">?</Button>
              <Button asChild><Link href={`/courses/${course.id}`}>戻る</Link></Button>
            </div>
          </div>
          <div className="mt-2">
            <div className="h-1.5 w-full rounded bg-[hsl(var(--muted))]">
              <div className="h-full rounded bg-[hsl(var(--primary))]" style={{ width: `${((idx + 1) / total) * 100}%` }} />
            </div>
            <p className="text-xs text-gray-600 mt-1">{idx + 1} / {total}</p>
          </div>
        </header>

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

        <div className="flex items-center justify-between">
          <div />
          <Button onClick={() => setSummaryOpen(true)} aria-label="セッションを終了">セッション終了</Button>
        </div>

        {current && (
          <LearnCard
            key={current.id}
            card={current}
            onNext={() => goto(idx + 1)}
            onPrev={() => goto(idx - 1)}
            isFirst={idx === 0}
            isLast={idx === total - 1}
            onResult={(res) => {
              const d = Date.now() - cardStartRef.current;
              setDurations((m) => ({ ...m, [current.id]: d }));
              setResults((m) => ({ ...m, [current.id]: res }));
            }}
            onRated={(r) => setRatings((m) => ({ ...m, [current.id]: r }))}
          />
        )}

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
                  setReplay(ids.length ? ids : null);
                  setSummaryOpen(false);
                }}
              >誤答のみ再演習</Button>
              <Button
                onClick={() => {
                  const ids = Object.entries(ratings)
                    .filter(([, r]) => r === "hard")
                    .map(([id]) => id);
                  setReplay(ids.length ? ids : null);
                  setSummaryOpen(false);
                }}
              >Hardのみ再演習</Button>
              <Button
                onClick={() => {
                  const flagged = cards.filter((c) => isFlagged(c.id)).map((c) => c.id);
                  setReplay(flagged.length ? flagged : null);
                  setSummaryOpen(false);
                }}
              >⭐ 要復習のみ再演習</Button>
              <Button
                onClick={() => {
                  setReplay(cards.map((c) => c.id));
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
      </main>
    </div>
  );
}

function LearnCard({
  card,
  onNext,
  onPrev,
  isFirst,
  isLast,
  onResult,
  onRated,
}: {
  card: Card;
  onNext: () => void;
  onPrev: () => void;
  isFirst: boolean;
  isLast: boolean;
  onResult?: (res: "correct" | "wrong") => void;
  onRated?: (r: SrsRating) => void;
}) {
  const prev = getProgress(card.id);
  const [flag, setFlag] = useState<boolean>(isFlagged(card.id));
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState<string>(getNote(card.id) ?? "");

  return (
    <div className="p-5 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
      <div className="mb-2">
        <span className="px-2 py-1 rounded bg-black/5 text-xs">{card.cardType}</span>
        {card.title ? <span className="ml-2 font-medium">{card.title}</span> : null}
        <div className="float-right flex items-center gap-2">
          <Button
            aria-label={flag ? "フラグ解除" : "フラグ"}
            onClick={() => setFlag(toggleFlag(card.id))}
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
                <Button onClick={() => { saveNote(card.id, note); setNoteOpen(false); }} variant="default">保存</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      {card.cardType === "text" && (
        <TextLearn content={card.content as TextCardContent} cardId={card.id} onNext={onNext} />
      )}
      {card.cardType === "quiz" && (
        <QuizLearn content={card.content as QuizCardContent} cardId={card.id} onNext={onNext} onResult={onResult} onRated={onRated} />
      )}
      {card.cardType === "fill-blank" && (
        <FillBlankLearn content={card.content as FillBlankCardContent} cardId={card.id} onNext={onNext} onResult={onResult} onRated={onRated} />
      )}

      <div className="mt-6 flex justify-between">
        <Button onClick={onPrev} disabled={isFirst} variant="outline">
          前へ
        </Button>
        <div className="text-sm text-gray-600">{prev?.completed ? "完了" : "未完了"}</div>
        <Button onClick={onNext} disabled={isLast} variant="outline">
          次へ
        </Button>
      </div>
    </div>
  );
}

function TextLearn({ content, cardId, onNext }: { content: TextCardContent; cardId: string; onNext: () => void }) {
  return (
    <div>
      <p className="whitespace-pre-wrap text-gray-800">{content.body}</p>
      <div className="mt-4">
        <Button
          onClick={() => {
            saveProgress({ cardId, completed: true, completedAt: new Date().toISOString() });
            onNext();
          }}
          variant="default"
        >
          次へ
        </Button>
      </div>
    </div>
  );
}

function QuizLearn({ content, cardId, onNext, onResult, onRated }: { content: QuizCardContent; cardId: string; onNext: () => void; onResult?: (r: "correct" | "wrong") => void; onRated?: (r: SrsRating) => void }) {
  const [selected, setSelected] = useState<number | null>(0);
  const [result, setResult] = useState<"idle" | "correct" | "wrong">("idle");
  const [revealed, setRevealed] = useState(false);

  // Hotkeys for quiz interaction
  useHotkeys(
    {
      Enter: () => submit(),
      " ": () => submit(),
      ArrowLeft: () => move(-1),
      ArrowRight: () => move(1),
      h: () => setRevealed((r) => !r),
      // 1–9 to select
      "1": () => choose(0),
      "2": () => choose(1),
      "3": () => choose(2),
      "4": () => choose(3),
      "5": () => choose(4),
      "6": () => choose(5),
      "7": () => choose(6),
      "8": () => choose(7),
      "9": () => choose(8),
    },
    [selected, result, content.options.length]
  );

  function choose(i: number) {
    if (i < content.options.length) setSelected(i);
  }
  function move(delta: number) {
    setSelected((i) => {
      const cur = i ?? 0;
      const next = (cur + delta + content.options.length) % content.options.length;
      return next;
    });
  }

  function submit() {
    if (selected == null) return;
    const ok = selected === content.answerIndex;
    setResult(ok ? "correct" : "wrong");
    onResult?.(ok ? "correct" : "wrong");
    saveProgress({
      cardId,
      completed: ok,
      completedAt: ok ? new Date().toISOString() : undefined,
      answer: { selected },
    });
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
        <Button onClick={onNext} variant="outline" aria-label="スキップ">Skip</Button>
        {result !== "idle" && (
          <span className={result === "correct" ? "text-green-600" : "text-red-600"}>
            {result === "correct" ? "正解！" : "不正解"}
          </span>
        )}
      </div>
      {(revealed || result !== "idle") && content.explanation && (
        <p className="mt-2 text-sm text-gray-700">{content.explanation}</p>
      )}
      {result !== "idle" && (
        <SrsPanel
          onSelect={(rating) => {
            onRated?.(rating);
            rateSrs(cardId, rating);
            setTimeout(onNext, 150);
          }}
        />
      )}
    </div>
  );
}

function FillBlankLearn({ content, cardId, onNext, onResult, onRated }: { content: FillBlankCardContent; cardId: string; onNext: () => void; onResult?: (r: "correct" | "wrong") => void; onRated?: (r: SrsRating) => void }) {
  const indices = Array.from(content.text.matchAll(/\[\[(\d+)\]\]/g)).map((m) => m[1]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<"idle" | "correct" | "wrong">("idle");
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Enter") check();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers]);

  function check() {
    const ok = indices.every((k) => {
      const a = (answers[k] ?? "").trim();
      const expect = content.answers[k]?.trim() ?? "";
      if (!content.caseSensitive) return a.toLowerCase() === expect.toLowerCase();
      return a === expect;
    });
    setResult(ok ? "correct" : "wrong");
    onResult?.(ok ? "correct" : "wrong");
    saveProgress({
      cardId,
      completed: ok,
      completedAt: ok ? new Date().toISOString() : undefined,
      answer: answers,
    });
  }

  // render text with inputs
  const parts = content.text.split(/(\[\[\d+\]\])/g);
  let inputCounter = 0;

  return (
    <div>
      <div className="text-gray-900">
        {parts.map((part, i) => {
          const m = part.match(/^\[\[(\d+)\]\]$/);
          if (!m) return <span key={i}>{part}</span>;
          const k = m[1];
          return (
            <Input
              key={i}
              className="w-24 mx-1 inline-flex"
              placeholder={`#${k}`}
              value={answers[k] ?? ""}
              onChange={(e) => setAnswers((s) => ({ ...s, [k]: e.target.value }))}
            />
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button onClick={check} variant="default" aria-label="採点する">Check</Button>
        <Button onClick={() => setRevealed((r) => !r)} variant="outline" aria-label="答えを表示">Reveal</Button>
        <Button onClick={onNext} variant="outline" aria-label="スキップ">Skip</Button>
        {result !== "idle" && (
          <span className={result === "correct" ? "text-green-600" : "text-red-600"}>
            {result === "correct" ? "正解！" : "不正解"}
          </span>
        )}
      </div>
      {(revealed || result === "wrong") && (
        <div className="mt-2 text-sm text-gray-700">
          <p>正答:</p>
          <pre className="mt-1 rounded bg-black/5 p-2 inline-block">{JSON.stringify(content.answers, null, 2)}</pre>
        </div>
      )}
      {result !== "idle" && (
        <SrsPanel
          onSelect={(rating) => {
            onRated?.(rating);
            rateSrs(cardId, rating);
            setTimeout(onNext, 150);
          }}
        />
      )}
    </div>
  );
}

function SrsPanel({ onSelect }: { onSelect: (r: SrsRating) => void }) {
  useHotkeys({
    "1": () => onSelect("again"),
    "2": () => onSelect("hard"),
    "3": () => onSelect("good"),
    "4": () => onSelect("easy"),
  }, []);
  return (
    <div className="mt-4 grid grid-cols-4 gap-2">
      <Button onClick={() => onSelect("again")} className="w-full" variant="outline" aria-label="Again (やり直し)">Again</Button>
      <Button onClick={() => onSelect("hard")} className="w-full" variant="outline" aria-label="Hard (難しい)">Hard</Button>
      <Button onClick={() => onSelect("good")} className="w-full" variant="outline" aria-label="Good (普通)">Good</Button>
      <Button onClick={() => onSelect("easy")} className="w-full" variant="outline" aria-label="Easy (簡単)">Easy</Button>
    </div>
  );
}
