"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  getCourse,
  listLessons,
  listCards,
  addCard,
  deleteCard,
  reorderCards,
} from "@/lib/localdb";
import type { Card, CardType, Course, Lesson, FillBlankCardContent, QuizCardContent, TextCardContent } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { SortableList } from "@/components/dnd/SortableList";

type NewCardState =
  | { type: "text"; title: string; body: string }
  | { type: "quiz"; title: string; question: string; options: string; answerIndex: number; explanation: string }
  | { type: "fill-blank"; title: string; text: string; answers: string; caseSensitive: boolean };

export default function LessonCardsPage() {
  const params = useParams<{ courseId: string; lessonId: string }>();
  const courseId = params.courseId;
  const lessonId = params.lessonId;
  const [course, setCourse] = useState<Course | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [newCard, setNewCard] = useState<NewCardState>({ type: "text", title: "", body: "" });

  function refresh() {
    setCourse(getCourse(courseId) ?? null);
    const l = listLessons(courseId).find((x) => x.id === lessonId) ?? null;
    setLesson(l);
    setCards(listCards(lessonId));
  }

  useEffect(() => {
    refresh();
  }, [courseId, lessonId]);

  function onAddCard(e: React.FormEvent) {
    e.preventDefault();
    if (newCard.type === "text") {
      if (!newCard.body.trim()) return alert("本文は必須です");
      addCard(lessonId, {
        cardType: "text",
        title: newCard.title || null,
        content: { body: newCard.body } as TextCardContent,
      });
    } else if (newCard.type === "quiz") {
      const opts = newCard.options.split("\n").map((s) => s.trim()).filter(Boolean);
      if (!newCard.question.trim() || opts.length < 2) return alert("設問と選択肢2つ以上が必要です");
      addCard(lessonId, {
        cardType: "quiz",
        title: newCard.title || null,
        content: {
          question: newCard.question,
          options: opts,
          answerIndex: Math.max(0, Math.min(newCard.answerIndex, opts.length - 1)),
          explanation: newCard.explanation || undefined,
        } as QuizCardContent,
      });
    } else {
      const answers: Record<string, string> = {};
      newCard.answers
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((line) => {
          const [k, ...rest] = line.split(":");
          const v = rest.join(":").trim();
          if (k && v) answers[k.trim()] = v;
        });
      if (!newCard.text.trim() || Object.keys(answers).length === 0)
        return alert("テキストと回答（例: 1:answer）を入力してください");
      addCard(lessonId, {
        cardType: "fill-blank",
        title: newCard.title || null,
        content: {
          text: newCard.text,
          answers,
          caseSensitive: newCard.caseSensitive,
        } as FillBlankCardContent,
      });
    }
    // clear and refresh
    setNewCard({ type: "text", title: "", body: "" });
    refresh();
  }

  function move(idx: number, dir: -1 | 1) {
    const ids = cards.map((c) => c.id);
    const to = idx + dir;
    if (to < 0 || to >= ids.length) return;
    ids.splice(to, 0, ids.splice(idx, 1)[0]);
    reorderCards(lessonId, ids);
    refresh();
  }

  if (!course || !lesson) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <p className="text-sm text-gray-600">レッスンが見つかりませんでした。</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <header className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-500">{course.title}</div>
            <h1 className="text-xl font-semibold">{lesson.title} のカード</h1>
          </div>
          <Button asChild><Link href={`/courses/${courseId}`}>戻る</Link></Button>
        </div>
      </header>

      <section className="mb-6">
        <h2 className="font-medium mb-2">新規カード</h2>
        <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
        <form onSubmit={onAddCard} className="space-y-3">
          <div className="flex gap-3 items-center">
            <label className="text-sm">タイプ</label>
            <Select
              value={newCard.type}
              onChange={(e) => {
                const t = e.target.value as CardType;
                if (t === "text") setNewCard({ type: "text", title: "", body: "" });
                if (t === "quiz")
                  setNewCard({
                    type: "quiz",
                    title: "",
                    question: "",
                    options: "",
                    answerIndex: 0,
                    explanation: "",
                  });
                if (t === "fill-blank")
                  setNewCard({ type: "fill-blank", title: "", text: "", answers: "1:answer", caseSensitive: false });
              }}
            >
              <option value="text">Text</option>
              <option value="quiz">Quiz</option>
              <option value="fill-blank">Fill‑blank</option>
            </Select>
            <Input
              value={(newCard as any).title ?? ""}
              onChange={(e) => setNewCard({ ...(newCard as any), title: e.target.value })}
              placeholder="タイトル（任意）"
              className="flex-1"
            />
          </div>

          {newCard.type === "text" && (
            <div>
              <label className="block text-sm font-medium mb-1">本文</label>
              <Textarea
                value={newCard.body}
                onChange={(e) => setNewCard({ ...newCard, body: e.target.value })}
                className=""
              />
            </div>
          )}

          {newCard.type === "quiz" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-1">設問</label>
                <Input
                  value={newCard.question}
                  onChange={(e) => setNewCard({ ...newCard, question: e.target.value })}
                  className=""
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">選択肢（改行区切り）</label>
                <Textarea
                  value={newCard.options}
                  onChange={(e) => setNewCard({ ...newCard, options: e.target.value })}
                  className=""
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">正解インデックス（0開始）</label>
                <Input
                  type="number"
                  value={newCard.answerIndex}
                  onChange={(e) => setNewCard({ ...newCard, answerIndex: Number(e.target.value) })}
                  className=""
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-1">解説（任意）</label>
                <Input
                  value={newCard.explanation}
                  onChange={(e) => setNewCard({ ...newCard, explanation: e.target.value })}
                  className=""
                />
              </div>
            </div>
          )}

          {newCard.type === "fill-blank" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-1">テキスト（[[1]] の形式で空所）</label>
                <Textarea
                  value={newCard.text}
                  onChange={(e) => setNewCard({ ...newCard, text: e.target.value })}
                  className=""
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">回答（例: 1:answer 改行区切り）</label>
                <Textarea
                  value={newCard.answers}
                  onChange={(e) => setNewCard({ ...newCard, answers: e.target.value })}
                  className=""
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="caseSensitive"
                  type="checkbox"
                  checked={newCard.caseSensitive}
                  onChange={(e) => setNewCard({ ...newCard, caseSensitive: e.target.checked })}
                />
                <label htmlFor="caseSensitive" className="text-sm">大文字小文字を区別</label>
              </div>
            </div>
          )}

          <div>
            <Button type="submit" variant="default">追加</Button>
          </div>
        </form>
        </div>
      </section>

      <section>
        <h2 className="font-medium mb-2">カード一覧</h2>
        {cards.length === 0 ? (
          <p className="text-sm text-gray-600">カードがありません。</p>
        ) : (
          <SortableList
            ids={cards.map((c) => c.id)}
            label="カードの並び替え"
            onReorder={(ids) => { reorderCards(lessonId, ids); refresh(); }}
            renderItem={(id, idx) => {
              // 並び替えや削除直後の短い間、SortableList の内部 state と
              // 親の cards state が一時的にズレることがある。その場合は安全にスキップ。
              const c = cards.find((x) => x.id === id);
              if (!c) {
                return <div className="text-xs text-gray-400">更新中…</div>;
              }
              return (
                <div className="flex items-center gap-2">
                  <span className="px-1 py-0.5 rounded bg-black/5 text-xs">{c.cardType}</span>
                  <span className="flex-1 truncate">{c.title || labelForCard(c)}</span>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      if (confirm("削除しますか？")) {
                        deleteCard(c.id);
                        refresh();
                      }
                    }}
                    className="text-xs"
                  >
                    削除
                  </Button>
                </div>
              );
            }}
          />
        )}
      </section>
    </div>
  );
}

function labelForCard(card: Card): string {
  if (card.cardType === "text") return "テキスト";
  if (card.cardType === "quiz") return (card.content as QuizCardContent).question;
  return (card.content as FillBlankCardContent).text.replace(/\[\[(\d+)\]\]/g, "□");
}

function CardPreview({ card }: { card: Card }) {
  if (card.cardType === "text") {
    const content = card.content as TextCardContent;
    return <p className="text-sm text-gray-700 whitespace-pre-wrap mt-2">{content.body}</p>;
  }
  if (card.cardType === "quiz") {
    const c = card.content as QuizCardContent;
    return (
      <div className="mt-2 text-sm">
        <div className="font-medium">{c.question}</div>
        <ul className="list-disc list-inside text-gray-700">
          {c.options.map((o, i) => (
            <li key={i}>{o}</li>
          ))}
        </ul>
      </div>
    );
  }
  const fb = card.content as FillBlankCardContent;
  return (
    <div className="mt-2 text-sm text-gray-700">
      <p className="whitespace-pre-wrap">{fb.text}</p>
    </div>
  );
}
