// Thin client wrappers that call /api/db, which delegates to Server Actions.
// This replaces deprecated '@/lib/localdb'. Keep functions minimal and typed.
import type {
  UUID,
  Course,
  Lesson,
  Card,
  Progress,
  SrsEntry,
  SrsRating,
  CoursePlan,
  LessonCards,
} from "@/lib/types";
import { createCourseAction, updateCourseAction, deleteCourseAction } from "@/server-actions/courses";
import { addLessonAction, deleteLessonAction, reorderLessonsAction } from "@/server-actions/lessons";
import { addCardAction, updateCardAction, deleteCardAction, deleteCardsAction, reorderCardsAction } from "@/server-actions/cards";
import { saveProgressAction, rateSrsAction, toggleFlagAction, saveNoteAction } from "@/server-actions/progress";
import { saveDraftAction, commitCoursePlanAction, commitCoursePlanPartialAction, commitLessonCardsAction, commitLessonCardsPartialAction, generateLessonCardsParallelAction, generateSingleCardAction } from "@/server-actions/ai";
import type { AiUpdate } from "@/lib/ai/log";
import type { CardType } from "@/lib/types";

type Snapshot = {
  courses: Course[];
  lessons: Lesson[];
  cards: Card[];
  progress: Progress[];
  flags: { cardId: UUID; flaggedAt: string }[];
  notes: { cardId: UUID; text: string; updatedAt: string }[];
};

async function api<T = unknown>(op: string, params?: unknown): Promise<T> {
  const res = await fetch("/api/db", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ op, params }),
  });
  if (!res.ok) throw new Error(await res.text());
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    // 認証ミドルウェアにより /login へリダイレクトされた場合など、HTMLが返ることがある
    const peek = (await res.text()).slice(0, 120);
    throw new Error(`Unexpected non-JSON response (content-type: ${ct || "unknown"}). Possibly redirected to /login. Snippet: ${peek}`);
  }
  return (await res.json()) as T;
}

// Reads
export async function snapshot(): Promise<Snapshot> {
  return await api<Snapshot>("snapshot");
}

export async function listCourses(): Promise<Course[]> {
  return await api<Course[]>("listCourses");
}

export async function getCourse(courseId: UUID): Promise<Course | undefined> {
  return (await api<Course | null>("getCourse", { courseId })) ?? undefined;
}

export async function listLessons(courseId: UUID): Promise<Lesson[]> {
  return await api<Lesson[]>("listLessons", { courseId });
}

export async function listCards(lessonId: UUID): Promise<Card[]> {
  return await api<Card[]>("listCards", { lessonId });
}

export async function getProgress(cardId: UUID): Promise<Progress | undefined> {
  return (await api<Progress | null>("getProgress", { cardId })) ?? undefined;
}

export async function listFlaggedByCourse(courseId: UUID): Promise<UUID[]> {
  return await api<UUID[]>("listFlaggedByCourse", { courseId });
}

export async function getNote(cardId: UUID): Promise<string | undefined> {
  return (await api<string | null>("getNote", { cardId })) ?? undefined;
}

// Writes (mutations) via Server Actions
export async function createCourse(input: { title: string; description?: string; category?: string }): Promise<{ courseId: UUID }> {
  return await createCourseAction(input);
}

export async function updateCourse(courseId: UUID, patch: Partial<Pick<Course, "title" | "description" | "category" | "status">>): Promise<void> {
  await updateCourseAction(courseId, patch);
}

export async function deleteCourse(courseId: UUID): Promise<void> {
  await deleteCourseAction(courseId);
}

export async function addLesson(courseId: UUID, title: string): Promise<{ lessonId: UUID }> {
  return await addLessonAction(courseId, title);
}

export async function deleteLesson(lessonId: UUID): Promise<void> {
  await deleteLessonAction(lessonId);
}

export async function reorderLessons(courseId: UUID, orderedIds: UUID[]): Promise<void> {
  await reorderLessonsAction(courseId, orderedIds);
}

export async function addCard(
  lessonId: UUID,
  card: Omit<Card, "id" | "lessonId" | "createdAt" | "orderIndex">
): Promise<UUID> {
  return await addCardAction(lessonId, card);
}

export async function updateCard(cardId: UUID, patch: Partial<Card>): Promise<void> {
  await updateCardAction(cardId, patch);
}

export async function deleteCard(cardId: UUID): Promise<void> {
  await deleteCardAction(cardId);
}

export async function deleteCards(ids: UUID[]): Promise<void> {
  await deleteCardsAction(ids);
}

export async function reorderCards(lessonId: UUID, orderedIds: UUID[]): Promise<void> {
  await reorderCardsAction(lessonId, orderedIds);
}

export async function saveProgress(input: Progress): Promise<void> {
  await saveProgressAction(input);
}

export async function rateSrs(cardId: UUID, rating: SrsRating): Promise<SrsEntry> {
  return await rateSrsAction(cardId, rating);
}

export async function toggleFlag(cardId: UUID): Promise<boolean> {
  return await toggleFlagAction(cardId);
}

export async function saveNote(cardId: UUID, text: string): Promise<void> {
  await saveNoteAction(cardId, text);
}

// AI drafts
export async function saveDraft(kind: "outline" | "lesson-cards", payload: CoursePlan | LessonCards): Promise<{ id: string }> {
  return await saveDraftAction(kind, payload);
}

export async function commitCoursePlan(draftId: string): Promise<{ courseId: UUID } | undefined> {
  return await commitCoursePlanAction(draftId);
}

export async function commitCoursePlanPartial(draftId: string, selectedIndexes: number[]): Promise<{ courseId: UUID } | undefined> {
  return await commitCoursePlanPartialAction(draftId, selectedIndexes);
}

export async function commitLessonCards(opts: { draftId: string; lessonId: UUID }): Promise<{ count: number; cardIds: UUID[] } | undefined> {
  return await commitLessonCardsAction(opts);
}

export async function commitLessonCardsPartial(opts: { draftId: string; lessonId: UUID; selectedIndexes: number[] }): Promise<{ count: number; cardIds: UUID[] } | undefined> {
  return await commitLessonCardsPartialAction(opts);
}

// AI generation (server-side parallel)
export async function generateLessonCardsParallel(opts: { courseId: UUID; lessonId: UUID; lessonTitle: string; desiredCount?: number }): Promise<{ count: number; cardIds: UUID[]; updates: AiUpdate[] }> {
  const res = await generateLessonCardsParallelAction(opts);
  return { count: res.committed?.count ?? 0, cardIds: res.committed?.cardIds ?? [], updates: res.updates };
}

export async function generateSingleCard(opts: { courseId?: UUID; lessonId: UUID; lessonTitle: string; desiredCardType?: CardType; userBrief?: string }): Promise<{ draftId: string; payload: LessonCards; committed?: { count: number; cardIds: UUID[] }; updates: AiUpdate[] }> {
  return await generateSingleCardAction(opts);
}

export type { Snapshot };
