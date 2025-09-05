"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import type { Card as CardModel, Progress, QuizCardContent, FillBlankCardContent, TextCardContent, UUID } from "@/lib/types";
import { snapshot as fetchSnapshot, saveProgress as saveProgressApi } from "@/lib/client-api";
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext, type CarouselApi } from "@/components/ui/carousel";
import { Progress as LinearProgress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { QuizOption } from "@/components/player/QuizOption";
import { Card, CardContent } from "@/components/ui/card";

type Props = {
  courseId: UUID;
  initialCardId?: UUID;
  initialLessonId?: UUID;
};

export function LearningCarousel({ courseId, initialCardId, initialLessonId }: Props) {
  const router = useRouter();
  const [cards, setCards] = React.useState<CardModel[]>([]);
  const [active, setActive] = React.useState(0);
  const [api, setApi] = React.useState<CarouselApi | null>(null);
  // per-card state: quiz/fill の採点結果や入力、slider で決まった level
  const [results, setResults] = React.useState<Record<string, "idle" | "correct" | "wrong">>({});
  const [levels, setLevels] = React.useState<Record<string, number | undefined>>({});
  const [quizSel, setQuizSel] = React.useState<Record<string, number | null>>({});
  const [fillAns, setFillAns] = React.useState<Record<string, Record<string, string>>>({});

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const snap = await fetchSnapshot();
      if (!mounted) return;
      const lessons = snap.lessons.filter((l) => l.courseId === courseId);
      const lessonOrder = new Map<string, number>(lessons.map((l) => [l.id, l.orderIndex] as const));
      const allCourseCards = snap.cards
        .filter((c) => lessons.some((l) => l.id === c.lessonId))
        .sort((a, b) => {
          const la = lessonOrder.get(a.lessonId) ?? 0;
          const lb = lessonOrder.get(b.lessonId) ?? 0;
          return (
            (la - lb) ||
            (a.orderIndex - b.orderIndex) ||
            a.createdAt.localeCompare(b.createdAt)
          );
        });

      // initialLessonId が指定された場合はそのレッスンにスコープ
      const scopedLessonId = initialLessonId && lessons.some((l) => l.id === initialLessonId) ? initialLessonId : undefined;
      const scopedCards = scopedLessonId ? allCourseCards.filter((c) => c.lessonId === scopedLessonId) : allCourseCards;
      const effectiveCards = scopedCards.length > 0 ? scopedCards : allCourseCards;

      // 開始位置の決定
      let startIndex = 0;
      if (initialCardId) {
        const idx = effectiveCards.findIndex((c) => c.id === initialCardId);
        startIndex = idx >= 0 ? idx : 0;
      } else if (scopedLessonId) {
        startIndex = 0; // レッスン指定時はその先頭
      } else {
        // レッスン未指定時はコースの最初のレッスン先頭カードを起点
        const firstLessonId = lessons[0]?.id;
        const idx = effectiveCards.findIndex((c) => c.lessonId === firstLessonId);
        startIndex = idx >= 0 ? idx : 0;
      }

      setCards(effectiveCards);
      setActive(startIndex);
    })();
    return () => { mounted = false; };
  }, [courseId, initialCardId, initialLessonId]);

  // embla 選択変更で active を同期
  const handleSelect = React.useCallback((a?: CarouselApi) => {
    const inst = a ?? api;
    if (!inst) return;
    const idx = inst.selectedScrollSnap();
    setActive(idx);
  }, [api]);

  React.useEffect(() => {
    if (!api) return;
    handleSelect(api);
    api.on("select", handleSelect);
    return () => { api.off("select", handleSelect); };
  }, [api, handleSelect]);

  // 初期スクロール位置の確定（apiが来てから）
  React.useEffect(() => {
    if (!api) return;
    const idx = api.selectedScrollSnap();
    if (idx !== active) api.scrollTo(active);
  }, [api, active]);

  const current = cards[active];
  const progressValue = cards.length ? ((active + 1) / cards.length) * 100 : 0;

  // save helper
  const saveProgress = React.useCallback((input: Progress) => {
    // 楽観更新
    if (typeof input.answer === "object" && input.answer && "level" in input.answer) {
      setLevels((m) => ({ ...m, [input.cardId]: (input.answer as Record<string, number>)["level"] }));
    }
    void saveProgressApi(input).catch((e) => console.error("saveProgress failed:", e));
  }, []);

  return (
    <div className="relative h-full w-full flex flex-col">
      {/* 上部: 進捗バー */}
      <div className="px-4 pt-10 mb-3">
        <div className="max-w-2xl mx-auto">
          <LinearProgress value={progressValue} size="lg" aria-label="学習進捗" />
          <div className="mt-1 text-xs text-gray-600">{active + 1} / {cards.length}</div>
        </div>
      </div>

      {/* 本体: カルーセル（中央にカード。矢印ボタンで移動） */}
      <div className="relative flex items-stretch mt-0">
        <Carousel
          className="w-full max-w-2xl mx-auto px-2 sm:px-4"
          setApi={setApi}
          opts={{ align: "start", loop: false }}
        >
          <CarouselContent className="-ml-4">
            {cards.map((card) => (
              <CarouselItem key={card.id} className="pl-4">
                <Card className="rounded-xl">
                  <CardContent className="p-6 min-h-[340px] sm:min-h-[440px] md:min-h-[500px]">
                    {/* タイトル */}
                    <div className="mb-3">
                      <span className="px-2 py-1 rounded bg-black/5 text-xs">{card.cardType}</span>
                      {card.title ? <span className="ml-2 font-medium">{card.title}</span> : null}
                    </div>
                    {/* カード本文 */}
                    <div className="text-[15px]">
                      {card.cardType === "text" && (
                        <TextContent content={card.content as TextCardContent} />
                      )}
                      {card.cardType === "quiz" && (
                        <QuizContent
                          cardId={card.id}
                          content={card.content as QuizCardContent}
                          selected={quizSel[card.id] ?? null}
                          onSelect={(n) => setQuizSel((m) => ({ ...m, [card.id]: n }))}
                          result={results[card.id] ?? "idle"}
                          onCheck={(res) => {
                            setResults((m) => ({ ...m, [card.id]: res }));
                            const input: Progress = { cardId: card.id, completed: false, answer: { selected: quizSel[card.id] ?? undefined, result: res } };
                            saveProgress(input);
                          }}
                        />
                      )}
                      {card.cardType === "fill-blank" && (
                        <FillBlankContent
                          cardId={card.id}
                          content={card.content as FillBlankCardContent}
                          values={fillAns[card.id] ?? {}}
                          onChange={(vals) => setFillAns((m) => ({ ...m, [card.id]: vals }))}
                          result={results[card.id] ?? "idle"}
                          onCheck={(res, vals) => {
                            setResults((m) => ({ ...m, [card.id]: res }));
                            const input: Progress = { cardId: card.id, completed: false, answer: { ...vals, result: res } };
                            saveProgress(input);
                          }}
                        />
                      )}
                    </div>
                  </CardContent>
                </Card>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>
      </div>

      {/* 下部: 理解度スライダー（text は常時、quiz/fill は Check 後） */}
      <div className="px-4 pb-4 pt-8">
        <div className="max-w-2xl mx-auto min-h-[80px]">
          {current ? (
            <UnderstandingBar
              cardId={current.id}
              visible={current.cardType === "text" ? true : (results[current.id] ?? "idle") !== "idle"}
              initial={levels[current.id]}
              onCommit={(lv) => {
                setLevels((m) => ({ ...m, [current.id]: lv }));
                const payload: Progress = {
                  cardId: current.id,
                  completed: lv >= 3,
                  completedAt: lv >= 3 ? new Date().toISOString() : undefined,
                  answer: { level: lv },
                };
                saveProgress(payload);
              }}
            />
          ) : (
            <div className="h-[80px]" aria-hidden />
          )}
        </div>
      </div>

      {/* 右上: 戻る */}
      <div className="absolute top-3 right-3">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            const targetId = current?.id;
            const url = targetId
              ? `/courses/${courseId}/workspace?cardId=${encodeURIComponent(targetId)}`
              : `/courses/${courseId}/workspace`;
            router.push(url);
          }}
          aria-label="ワークスペースに戻る"
        >
          ワークスペースに戻る
        </Button>
      </div>
    </div>
  );
}

function UnderstandingBar({ cardId, visible, initial, onCommit }: { cardId: string; visible: boolean; initial?: number; onCommit: (level: number) => void }) {
  const [lv, setLv] = React.useState<number>(initial ?? 0);
  React.useEffect(() => { setLv(initial ?? 0); }, [cardId, initial]);
  if (!visible) return null;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-gray-700">理解度: {lv > 0 ? `${lv}/5` : "未評価"}</span>
        <span className="text-xs text-gray-500">3以上で完了</span>
      </div>
      <Slider
        min={1}
        max={5}
        step={1}
        value={lv ? [lv] : [1]}
        onValueChange={(v) => setLv(v[0] ?? 1)}
        onValueCommit={(v) => onCommit(v[0] ?? 1)}
        aria-label="理解度"
      />
      <div className="mt-1 flex justify-between text-[10px] text-gray-500">
        <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
      </div>
    </div>
  );
}

function TextContent({ content }: { content: TextCardContent }) {
  return <p className="whitespace-pre-wrap text-gray-800">{content.body}</p>;
}

function QuizContent({ cardId, content, selected, onSelect, result, onCheck }: {
  cardId: string;
  content: QuizCardContent;
  selected: number | null;
  onSelect: (n: number) => void;
  result: "idle" | "correct" | "wrong";
  onCheck: (res: "correct" | "wrong") => void;
}) {
  const [hint, setHint] = React.useState(false);
  return (
    <div>
      <div className="font-medium text-gray-900">{content.question}</div>
      <div role="radiogroup" aria-label="選択肢" className="mt-2 space-y-2">
        {content.options.map((o, i) => (
          <QuizOption key={i} id={`opt-${cardId}-${i}`} label={o} checked={selected === i} onSelect={() => onSelect(i)} />
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button onClick={() => onCheck((selected ?? -1) === content.answerIndex ? "correct" : "wrong")} variant="default" aria-label="採点する">Check</Button>
        <Button onClick={() => setHint((v) => !v)} variant="outline" aria-label="ヒントを表示">Hint</Button>
        <span aria-live="polite" role="status" className={result === "correct" ? "text-green-600" : result === "wrong" ? "text-red-600" : "sr-only"}>
          {result === "correct" ? "正解！" : result === "wrong" ? "不正解" : ""}
        </span>
      </div>
      {(hint || result !== "idle") && content.explanation && (
        <p className="mt-2 text-sm text-gray-700">{content.explanation}</p>
      )}
    </div>
  );
}

function FillBlankContent({ cardId, content, values, onChange, result, onCheck }: {
  cardId: string;
  content: FillBlankCardContent;
  values: Record<string, string>;
  onChange: (vals: Record<string, string>) => void;
  result: "idle" | "correct" | "wrong";
  onCheck: (res: "correct" | "wrong", vals: Record<string, string>) => void;
}) {
  const indices = React.useMemo(() => Array.from(content.text.matchAll(/\[\[(\d+)\]\]/g)).map((m) => m[1]), [content.text]);
  function check() {
    const ok = indices.every((k) => {
      const a = (values[k] ?? "").trim();
      const expect = content.answers[k]?.trim() ?? "";
      if (!content.caseSensitive) return a.toLowerCase() === expect.toLowerCase();
      return a === expect;
    });
    onCheck(ok ? "correct" : "wrong", values);
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
            <Input key={i} className="w-24 mx-1 inline-flex" placeholder={`#${k}`} value={values[k] ?? ""} onChange={(e) => onChange({ ...values, [k]: e.target.value })} />
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button onClick={check} variant="default">Check</Button>
        <span aria-live="polite" role="status" className={result === "correct" ? "text-green-600" : result === "wrong" ? "text-red-600" : "sr-only"}>
          {result === "correct" ? "正解！" : result === "wrong" ? "不正解" : ""}
        </span>
      </div>
    </div>
  );
}

export default LearningCarousel;
