"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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

export default function LearnCoursePage() {
  const params = useParams<{ courseId: string }>();
  const courseId = params.courseId;
  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
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
  const current = cards[idx];
  const total = cards.length;

  function goto(i: number) {
    setIdx(Math.max(0, Math.min(total - 1, i)));
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "?") setShowHelp((s) => !s);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
          <p className="text-sm text-gray-600 mt-1">
            {idx + 1} / {total}
          </p>
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

        {current && (
          <LearnCard
            key={current.id}
            card={current}
            onNext={() => goto(idx + 1)}
            onPrev={() => goto(idx - 1)}
            isFirst={idx === 0}
            isLast={idx === total - 1}
          />
        )}
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
}: {
  card: Card;
  onNext: () => void;
  onPrev: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const prev = getProgress(card.id);

  return (
    <div className="p-5 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
      <div className="mb-2">
        <span className="px-2 py-1 rounded bg-black/5 text-xs">{card.cardType}</span>
        {card.title ? <span className="ml-2 font-medium">{card.title}</span> : null}
      </div>
      {card.cardType === "text" && (
        <TextLearn content={card.content as TextCardContent} cardId={card.id} onNext={onNext} />
      )}
      {card.cardType === "quiz" && (
        <QuizLearn content={card.content as QuizCardContent} cardId={card.id} onNext={onNext} />
      )}
      {card.cardType === "fill-blank" && (
        <FillBlankLearn content={card.content as FillBlankCardContent} cardId={card.id} onNext={onNext} />
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

function QuizLearn({ content, cardId, onNext }: { content: QuizCardContent; cardId: string; onNext: () => void }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [result, setResult] = useState<"idle" | "correct" | "wrong">("idle");
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key >= "1" && e.key <= "9") {
        const idx = Number(e.key) - 1;
        if (idx < content.options.length) setSelected(idx);
      }
      if (e.key === "Enter") submit();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content.options.length, selected]);

  function submit() {
    if (selected == null) return;
    const ok = selected === content.answerIndex;
    setResult(ok ? "correct" : "wrong");
    saveProgress({
      cardId,
      completed: ok,
      completedAt: ok ? new Date().toISOString() : undefined,
      answer: { selected },
    });
    if (ok) setTimeout(onNext, 300);
  }

  return (
    <div>
      <div className="font-medium text-gray-900">{content.question}</div>
      <ul className="mt-2 space-y-2">
        {content.options.map((o, i) => (
          <li key={i}>
            <label className="flex items-center gap-2">
              <input type="radio" name="q" checked={selected === i} onChange={() => setSelected(i)} />
              <span>{o}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center gap-3">
        <Button onClick={submit} variant="default">
          回答
        </Button>
        {result !== "idle" && (
          <span className={result === "correct" ? "text-green-600" : "text-red-600"}>
            {result === "correct" ? "正解！" : "不正解"}
          </span>
        )}
      </div>
      {result !== "idle" && content.explanation && (
        <p className="mt-2 text-sm text-gray-700">{content.explanation}</p>
      )}
    </div>
  );
}

function FillBlankLearn({ content, cardId, onNext }: { content: FillBlankCardContent; cardId: string; onNext: () => void }) {
  const indices = Array.from(content.text.matchAll(/\[\[(\d+)\]\]/g)).map((m) => m[1]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<"idle" | "correct" | "wrong">("idle");
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
    saveProgress({
      cardId,
      completed: ok,
      completedAt: ok ? new Date().toISOString() : undefined,
      answer: answers,
    });
    if (ok) setTimeout(onNext, 300);
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
        <Button onClick={check} variant="default">
          回答
        </Button>
        {result !== "idle" && (
          <span className={result === "correct" ? "text-green-600" : "text-red-600"}>
            {result === "correct" ? "正解！" : "不正解"}
          </span>
        )}
      </div>
    </div>
  );
}
