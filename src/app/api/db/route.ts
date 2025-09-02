import { NextResponse } from "next/server";
import { z } from "zod";
import type { UUID, Card, CoursePlan, LessonCards } from "@/lib/types";
import * as Q from "@/lib/db/queries";
import { createCourseAction, deleteCourseAction, updateCourseAction } from "@/server-actions/courses";
import { addLessonAction, deleteLessonAction, reorderLessonsAction } from "@/server-actions/lessons";
import { addCardAction, deleteCardAction, deleteCardsAction, reorderCardsAction, updateCardAction } from "@/server-actions/cards";
import { saveProgressAction, rateSrsAction, toggleFlagAction, saveNoteAction } from "@/server-actions/progress";
import { saveDraftAction, commitCoursePlanAction, commitCoursePlanPartialAction, commitLessonCardsAction, commitLessonCardsPartialAction } from "@/server-actions/ai";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const op = String(body?.op || "");
    const p = body?.params ?? {};
    switch (op) {
      case "snapshot": {
        const data = await Q.snapshot();
        return NextResponse.json(data);
      }
      // ----- Reads -----
      case "listCourses": {
        const data = await Q.listCourses();
        return NextResponse.json(data);
      }
      case "getCourse": {
        const { courseId } = z.object({ courseId: z.string().uuid() }).parse(p);
        const data = await Q.getCourse(courseId);
        return NextResponse.json(data ?? null);
      }
      case "listLessons": {
        const { courseId } = z.object({ courseId: z.string().uuid() }).parse(p);
        const data = await Q.listLessons(courseId);
        return NextResponse.json(data);
      }
      case "listCards": {
        const { lessonId } = z.object({ lessonId: z.string().uuid() }).parse(p);
        const data = await Q.listCards(lessonId);
        return NextResponse.json(data);
      }
      case "getProgress": {
        const { cardId } = z.object({ cardId: z.string().uuid() }).parse(p);
        const data = await Q.getProgress(cardId);
        return NextResponse.json(data ?? null);
      }
      case "listFlaggedByCourse": {
        const { courseId } = z.object({ courseId: z.string().uuid() }).parse(p);
        const ids = await Q.listFlaggedByCourse(courseId);
        return NextResponse.json(ids);
      }
      case "getNote": {
        const { cardId } = z.object({ cardId: z.string().uuid() }).parse(p);
        const text = await Q.getNote(cardId);
        return NextResponse.json(text ?? null);
      }
      // ----- Writes (Server Actions under the hood) -----
      case "createCourse": {
        const { title, description, category } = z
          .object({ title: z.string().min(1), description: z.string().optional(), category: z.string().optional() })
          .parse(p);
        const res = await createCourseAction({ title, description, category });
        return NextResponse.json(res);
      }
      case "updateCourse": {
        const { courseId, patch } = z
          .object({
            courseId: z.string().uuid(),
            patch: z.object({ title: z.string().optional(), description: z.string().nullable().optional(), category: z.string().nullable().optional(), status: z.enum(["draft", "published"]).optional() }),
          })
          .parse(p);
        const patchNorm = { ...patch, description: patch.description ?? undefined, category: patch.category ?? undefined } as Partial<{ title: string; description?: string; category?: string; status: "draft" | "published" }>;
        await updateCourseAction(courseId, patchNorm);
        return NextResponse.json({ ok: true });
      }
      case "deleteCourse": {
        const { courseId } = z.object({ courseId: z.string().uuid() }).parse(p);
        await deleteCourseAction(courseId);
        return NextResponse.json({ ok: true });
      }
      case "addLesson": {
        const { courseId, title } = z.object({ courseId: z.string().uuid(), title: z.string().min(1) }).parse(p);
        const res = await addLessonAction(courseId, title);
        return NextResponse.json(res);
      }
      case "deleteLesson": {
        const { lessonId } = z.object({ lessonId: z.string().uuid() }).parse(p);
        await deleteLessonAction(lessonId);
        return NextResponse.json({ ok: true });
      }
      case "reorderLessons": {
        const { courseId, orderedIds } = z.object({ courseId: z.string().uuid(), orderedIds: z.array(z.string().uuid()) }).parse(p);
        await reorderLessonsAction(courseId, orderedIds as UUID[]);
        return NextResponse.json({ ok: true });
      }
      case "addCard": {
        const textContent = z.object({ body: z.string() });
        const quizContent = z.object({ question: z.string(), options: z.array(z.string()), answerIndex: z.number().int().nonnegative(), explanation: z.string().nullable().optional() });
        const fillContent = z.object({ text: z.string(), answers: z.record(z.string(), z.string()), caseSensitive: z.boolean().optional() });
        const base = { title: z.string().nullable().optional(), tags: z.array(z.string()).optional() };
        const textCard = z.object({ lessonId: z.string().uuid(), card: z.object({ cardType: z.literal("text"), ...base, content: textContent }) });
        const quizCard = z.object({ lessonId: z.string().uuid(), card: z.object({ cardType: z.literal("quiz"), ...base, content: quizContent }) });
        const fillCard = z.object({ lessonId: z.string().uuid(), card: z.object({ cardType: z.literal("fill-blank"), ...base, content: fillContent }) });
        const { lessonId, card } = z.union([textCard, quizCard, fillCard]).parse(p);
        const id = await addCardAction(lessonId, card as Omit<Card, "id" | "lessonId" | "createdAt" | "orderIndex">);
        return NextResponse.json({ id });
      }
      case "updateCard": {
        const { cardId, patch } = z.object({ cardId: z.string().uuid(), patch: z.unknown() }).parse(p);
        await updateCardAction(cardId, patch as Partial<Card>);
        return NextResponse.json({ ok: true });
      }
      case "deleteCard": {
        const { cardId } = z.object({ cardId: z.string().uuid() }).parse(p);
        await deleteCardAction(cardId);
        return NextResponse.json({ ok: true });
      }
      case "deleteCards": {
        const { ids } = z.object({ ids: z.array(z.string().uuid()) }).parse(p);
        await deleteCardsAction(ids as UUID[]);
        return NextResponse.json({ ok: true });
      }
      case "reorderCards": {
        const { lessonId, orderedIds } = z.object({ lessonId: z.string().uuid(), orderedIds: z.array(z.string().uuid()) }).parse(p);
        await reorderCardsAction(lessonId, orderedIds as UUID[]);
        return NextResponse.json({ ok: true });
      }
      case "saveProgress": {
        const progressSchema = z.object({ cardId: z.string().uuid(), completed: z.boolean(), completedAt: z.string().optional(), answer: z.unknown().optional() });
        const { input } = z.object({ input: progressSchema }).parse(p);
        await saveProgressAction(input);
        return NextResponse.json({ ok: true });
      }
      case "rateSrs": {
        const { cardId, rating } = z.object({ cardId: z.string().uuid(), rating: z.enum(["again", "hard", "good", "easy"]) }).parse(p);
        const entry = await rateSrsAction(cardId, rating);
        return NextResponse.json(entry);
      }
      case "toggleFlag": {
        const { cardId } = z.object({ cardId: z.string().uuid() }).parse(p);
        const on = await toggleFlagAction(cardId);
        return NextResponse.json({ on });
      }
      case "saveNote": {
        const { cardId, text } = z.object({ cardId: z.string().uuid(), text: z.string() }).parse(p);
        await saveNoteAction(cardId, text);
        return NextResponse.json({ ok: true });
      }
      case "saveDraft": {
        const planCourse = z.object({ title: z.string(), description: z.string().optional(), category: z.string().optional() });
        const planSchema = z.object({ course: planCourse, lessons: z.array(z.object({ title: z.string(), summary: z.string().optional() })) });
        const lcText = z.object({ type: z.literal("text"), title: z.string().nullable().optional(), body: z.string() });
        const lcQuiz = z.object({ type: z.literal("quiz"), title: z.string().nullable().optional(), question: z.string(), options: z.array(z.string()), answerIndex: z.number().int().nonnegative(), explanation: z.string().nullable().optional() });
        const lcFill = z.object({ type: z.literal("fill-blank"), title: z.string().nullable().optional(), text: z.string(), answers: z.record(z.string(), z.string()), caseSensitive: z.boolean().optional() });
        const lessonCardsSchema = z.object({ lessonTitle: z.string(), cards: z.array(z.union([lcText, lcQuiz, lcFill])) });
        const { kind, payload } = z.union([
          z.object({ kind: z.literal("outline"), payload: planSchema }),
          z.object({ kind: z.literal("lesson-cards"), payload: lessonCardsSchema }),
        ]).parse(p);
        const res = await saveDraftAction(kind, payload as CoursePlan | LessonCards);
        return NextResponse.json(res);
      }
      case "commitCoursePlan": {
        const { draftId } = z.object({ draftId: z.string().uuid() }).parse(p);
        const res = await commitCoursePlanAction(draftId);
        return NextResponse.json(res ?? null);
      }
      case "commitCoursePlanPartial": {
        const { draftId, selectedIndexes } = z.object({ draftId: z.string().uuid(), selectedIndexes: z.array(z.number().int().nonnegative()) }).parse(p);
        const res = await commitCoursePlanPartialAction(draftId, selectedIndexes);
        return NextResponse.json(res ?? null);
      }
      case "commitLessonCards": {
        const { draftId, lessonId } = z.object({ draftId: z.string().uuid(), lessonId: z.string().uuid() }).parse(p);
        const res = await commitLessonCardsAction({ draftId, lessonId });
        return NextResponse.json(res ?? null);
      }
      case "commitLessonCardsPartial": {
        const { draftId, lessonId, selectedIndexes } = z
          .object({ draftId: z.string().uuid(), lessonId: z.string().uuid(), selectedIndexes: z.array(z.number().int().nonnegative()) })
          .parse(p);
        const res = await commitLessonCardsPartialAction({ draftId, lessonId, selectedIndexes });
        return NextResponse.json(res ?? null);
      }
      default:
        return new NextResponse(`Unknown op: ${op}`, { status: 400 });
    }
  } catch (e: unknown) {
    console.error("/api/db error", e);
    const msg = (e as { message?: string } | undefined)?.message ?? "Internal Error";
    return new NextResponse(msg, { status: 500 });
  }
}
