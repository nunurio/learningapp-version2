import { notFound } from "next/navigation";
import type { UUID, Card, QuizCardContent } from "@/lib/types";
import { snapshot as fetchSnapshot } from "@/lib/db/queries";
import FullScreenEditor from "@/components/editor/FullScreenEditor";

type Params = { courseId: UUID; cardId: UUID };

export const metadata = {
  title: "カード編集",
};

export default async function Page({ params }: { params: Promise<Params> }) {
  const { courseId, cardId } = await params;
  const snap = await fetchSnapshot();
  const card = snap.cards.find((c) => c.id === cardId);
  if (!card) return notFound();
  const lesson = snap.lessons.find((l) => l.id === card.lessonId);
  if (!lesson || lesson.courseId !== courseId) return notFound();

  if (card.cardType === "text") {
    const body = (card.content as { body?: string }).body ?? "";
    return (
      <FullScreenEditor
        courseId={courseId}
        cardId={cardId}
        cardType="text"
        title={card.title ?? null}
        tags={card.tags ?? []}
        body={body}
      />
    );
  }

  if (card.cardType === "quiz") {
    const c = card.content as QuizCardContent;
    return (
      <FullScreenEditor
        courseId={courseId}
        cardId={cardId}
        cardType="quiz"
        title={card.title ?? null}
        tags={card.tags ?? []}
        question={c.question}
        options={c.options}
        answerIndex={c.answerIndex}
        explanation={c.explanation ?? null}
        optionExplanations={c.optionExplanations ?? []}
        hint={c.hint ?? null}
      />
    );
  }

  if (card.cardType === "fill-blank") {
    const c = card.content as { text: string; answers: Record<string, string>; caseSensitive?: boolean };
    return (
      <FullScreenEditor
        courseId={courseId}
        cardId={cardId}
        cardType="fill-blank"
        title={card.title ?? null}
        tags={card.tags ?? []}
        text={c.text}
        answers={c.answers}
        caseSensitive={c.caseSensitive}
      />
    );
  }

  return notFound();
}
