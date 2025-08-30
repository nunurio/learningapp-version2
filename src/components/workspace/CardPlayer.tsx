"use client";
import * as React from "react";
import { listLessons, listCards, saveProgress, rateSrs } from "@/lib/localdb";
import type { UUID, Card, QuizCardContent, FillBlankCardContent, SrsRating, TextCardContent } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QuizOption } from "@/components/player/QuizOption";

type Props = {
  courseId: UUID;
  selectedId?: UUID;
  selectedKind?: "lesson" | "card";
};

export function CardPlayer({ courseId, selectedId, selectedKind }: Props) {
  const [card, setCard] = React.useState<Card | null>(null);

  React.useEffect(() => {
    if (!selectedId) { setCard(null); return; }
    if (selectedKind === "card") {
      const ls = listLessons(courseId);
      const found = ls.flatMap((l) => listCards(l.id)).find((c) => c.id === selectedId) ?? null;
      setCard(found);
    } else {
      setCard(null);
    }
  }, [courseId, selectedId, selectedKind]);

  if (!selectedId || !card) {
    return <p className="text-sm text-gray-700">カードを選択すると、ここで学習できます。</p>;
  }

  return (
    <div className="p-2">
      <div className="mb-2">
        <span className="px-2 py-1 rounded bg-black/5 text-xs">{card.cardType}</span>
        {card.title ? <span className="ml-2 font-medium">{card.title}</span> : null}
      </div>
      {card.cardType === "text" && (
        <TextLearn content={card.content as TextCardContent} cardId={card.id} />
      )}
      {card.cardType === "quiz" && (
        <QuizLearn content={card.content as QuizCardContent} cardId={card.id} />
      )}
      {card.cardType === "fill-blank" && (
        <FillBlankLearn content={card.content as FillBlankCardContent} cardId={card.id} />
      )}
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
        <Button onClick={() => saveProgress({ cardId, completed: true, completedAt: new Date().toISOString() })}>完了</Button>
      </div>
    </div>
  );
}

function QuizLearn({ content, cardId }: { content: QuizCardContent; cardId: string }) {
  const [selected, setSelected] = React.useState<number | null>(0);
  const [result, setResult] = React.useState<"idle" | "correct" | "wrong">("idle");
  const [revealed, setRevealed] = React.useState(false);

  function submit() {
    if (selected == null) return;
    const ok = selected === content.answerIndex;
    setResult(ok ? "correct" : "wrong");
    saveProgress({ cardId, completed: ok, completedAt: ok ? new Date().toISOString() : undefined, answer: { selected } });
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
        <SrsPanel onSelect={(rating) => { rateSrs(cardId, rating); }} />
      )}
    </div>
  );
}

function FillBlankLearn({ content, cardId }: { content: FillBlankCardContent; cardId: string }) {
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
    saveProgress({ cardId, completed: ok, completedAt: ok ? new Date().toISOString() : undefined, answer: answers });
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
        <span
          aria-live="polite"
          role="status"
          className={result === "correct" ? "text-green-600" : result === "wrong" ? "text-red-600" : "sr-only"}
        >
          {result === "correct" ? "正解！" : result === "wrong" ? "不正解" : ""}
        </span>
      </div>
      {result !== "idle" && (
        <SrsPanel onSelect={(rating) => { rateSrs(cardId, rating); }} />
      )}
    </div>
  );
}
