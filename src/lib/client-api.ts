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

// Writes (mutations)
export async function createCourse(input: { title: string; description?: string; category?: string }): Promise<{ courseId: UUID }> {
  return await api<{ courseId: UUID }>("createCourse", input);
}

export async function updateCourse(courseId: UUID, patch: Partial<Pick<Course, "title" | "description" | "category" | "status">>): Promise<void> {
  await api("updateCourse", { courseId, patch });
}

export async function deleteCourse(courseId: UUID): Promise<void> {
  await api("deleteCourse", { courseId });
}

export async function addLesson(courseId: UUID, title: string): Promise<{ lessonId: UUID }> {
  return await api<{ lessonId: UUID }>("addLesson", { courseId, title });
}

export async function deleteLesson(lessonId: UUID): Promise<void> {
  await api("deleteLesson", { lessonId });
}

export async function reorderLessons(courseId: UUID, orderedIds: UUID[]): Promise<void> {
  await api("reorderLessons", { courseId, orderedIds });
}

export async function addCard(
  lessonId: UUID,
  card: Omit<Card, "id" | "lessonId" | "createdAt" | "orderIndex">
): Promise<UUID> {
  const { id } = await api<{ id: UUID }>("addCard", { lessonId, card });
  return id;
}

export async function updateCard(cardId: UUID, patch: Partial<Card>): Promise<void> {
  await api("updateCard", { cardId, patch });
}

export async function deleteCard(cardId: UUID): Promise<void> {
  await api("deleteCard", { cardId });
}

export async function deleteCards(ids: UUID[]): Promise<void> {
  await api("deleteCards", { ids });
}

export async function reorderCards(lessonId: UUID, orderedIds: UUID[]): Promise<void> {
  await api("reorderCards", { lessonId, orderedIds });
}

export async function saveProgress(input: Progress): Promise<void> {
  await api("saveProgress", { input });
}

export async function rateSrs(cardId: UUID, rating: SrsRating): Promise<SrsEntry> {
  return await api<SrsEntry>("rateSrs", { cardId, rating });
}

export async function toggleFlag(cardId: UUID): Promise<boolean> {
  const { on } = await api<{ on: boolean }>("toggleFlag", { cardId });
  return on;
}

export async function saveNote(cardId: UUID, text: string): Promise<void> {
  await api("saveNote", { cardId, text });
}

// AI drafts
export async function saveDraft(kind: "outline" | "lesson-cards", payload: CoursePlan | LessonCards): Promise<{ id: string }> {
  return await api<{ id: string }>("saveDraft", { kind, payload });
}

export async function commitCoursePlan(draftId: string): Promise<{ courseId: UUID } | undefined> {
  return (await api<{ courseId: UUID } | null>("commitCoursePlan", { draftId })) ?? undefined;
}

export async function commitCoursePlanPartial(draftId: string, selectedIndexes: number[]): Promise<{ courseId: UUID } | undefined> {
  return (await api<{ courseId: UUID } | null>("commitCoursePlanPartial", { draftId, selectedIndexes })) ?? undefined;
}

export async function commitLessonCards(opts: { draftId: string; lessonId: UUID }): Promise<{ count: number; cardIds: UUID[] } | undefined> {
  return (await api<{ count: number; cardIds: UUID[] } | null>("commitLessonCards", opts)) ?? undefined;
}

export async function commitLessonCardsPartial(opts: { draftId: string; lessonId: UUID; selectedIndexes: number[] }): Promise<{ count: number; cardIds: UUID[] } | undefined> {
  return (await api<{ count: number; cardIds: UUID[] } | null>("commitLessonCardsPartial", opts)) ?? undefined;
}

export type { Snapshot };
