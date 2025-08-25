"use client";

import type {
  AiDraft,
  Card,
  Course,
  Lesson,
  LessonCards,
  Progress,
  UUID,
  CoursePlan,
} from "./types";

const STORAGE_KEY = "learnify_v1";

type DB = {
  courses: Course[];
  lessons: Lesson[];
  cards: Card[];
  progress: Progress[];
  drafts: AiDraft[];
};

function emptyDb(): DB {
  return { courses: [], lessons: [], cards: [], progress: [], drafts: [] };
}

function nowIso() {
  return new Date().toISOString();
}

function uuid(): UUID {
  // Prefer Web Crypto; fallback to timestamp-based id
  try {
    const g = (globalThis as any).crypto?.randomUUID;
    if (g) return g();
  } catch {}
  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function load(): DB {
  if (typeof window === "undefined") return emptyDb();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyDb();
    const parsed = JSON.parse(raw) as Partial<DB>;
    return {
      courses: parsed.courses ?? [],
      lessons: parsed.lessons ?? [],
      cards: parsed.cards ?? [],
      progress: parsed.progress ?? [],
      drafts: parsed.drafts ?? [],
    };
  } catch {
    return emptyDb();
  }
}

function save(db: DB) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

// Public API

export function listCourses(): Course[] {
  return load().courses.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getCourse(courseId: UUID): Course | undefined {
  return load().courses.find((c) => c.id === courseId);
}

export function createCourse(input: {
  title: string;
  description?: string;
  category?: string;
}): { courseId: UUID } {
  const db = load();
  const id = uuid();
  const now = nowIso();
  db.courses.push({
    id,
    title: input.title.trim(),
    description: input.description?.trim() || undefined,
    category: input.category?.trim() || undefined,
    status: "draft",
    createdAt: now,
    updatedAt: now,
  });
  save(db);
  return { courseId: id };
}

export function updateCourse(courseId: UUID, patch: Partial<Course>) {
  const db = load();
  const idx = db.courses.findIndex((c) => c.id === courseId);
  if (idx === -1) return;
  db.courses[idx] = { ...db.courses[idx], ...patch, updatedAt: nowIso() };
  save(db);
}

export function deleteCourse(courseId: UUID) {
  const db = load();
  db.courses = db.courses.filter((c) => c.id !== courseId);
  const lessonIds = db.lessons.filter((l) => l.courseId === courseId).map((l) => l.id);
  db.lessons = db.lessons.filter((l) => l.courseId !== courseId);
  db.cards = db.cards.filter((cd) => !lessonIds.includes(cd.lessonId));
  db.progress = db.progress.filter((p) => db.cards.some((c) => c.id === p.cardId));
  save(db);
}

export function listLessons(courseId: UUID): Lesson[] {
  return load()
    .lessons.filter((l) => l.courseId === courseId)
    .sort((a, b) => a.orderIndex - b.orderIndex || a.createdAt.localeCompare(b.createdAt));
}

export function addLesson(courseId: UUID, title: string): { lessonId: UUID } {
  const db = load();
  const id = uuid();
  const now = nowIso();
  const current = db.lessons.filter((l) => l.courseId === courseId);
  const nextIndex = current.length ? Math.max(...current.map((l) => l.orderIndex)) + 1 : 0;
  db.lessons.push({ id, courseId, title: title.trim(), orderIndex: nextIndex, createdAt: now });
  const cidx = db.courses.findIndex((c) => c.id === courseId);
  if (cidx !== -1) db.courses[cidx].updatedAt = now;
  save(db);
  return { lessonId: id };
}

export function deleteLesson(lessonId: UUID) {
  const db = load();
  const courseId = db.lessons.find((l) => l.id === lessonId)?.courseId;
  db.lessons = db.lessons.filter((l) => l.id !== lessonId);
  db.cards = db.cards.filter((c) => c.lessonId !== lessonId);
  if (courseId) {
    const cidx = db.courses.findIndex((c) => c.id === courseId);
    if (cidx !== -1) db.courses[cidx].updatedAt = nowIso();
  }
  save(db);
}

export function reorderLessons(courseId: UUID, orderedIds: UUID[]) {
  const db = load();
  const map = new Map(orderedIds.map((id, idx) => [id, idx] as const));
  db.lessons = db.lessons.map((l) =>
    l.courseId === courseId && map.has(l.id) ? { ...l, orderIndex: map.get(l.id)! } : l
  );
  const cidx = db.courses.findIndex((c) => c.id === courseId);
  if (cidx !== -1) db.courses[cidx].updatedAt = nowIso();
  save(db);
}

export function listCards(lessonId: UUID): Card[] {
  return load()
    .cards.filter((c) => c.lessonId === lessonId)
    .sort((a, b) => a.orderIndex - b.orderIndex || a.createdAt.localeCompare(b.createdAt));
}

export function addCard(
  lessonId: UUID,
  card: Omit<Card, "id" | "lessonId" | "createdAt" | "orderIndex">
): UUID {
  const db = load();
  const id = uuid();
  const now = nowIso();
  const siblings = db.cards.filter((c) => c.lessonId === lessonId);
  const nextIndex = siblings.length ? Math.max(...siblings.map((c) => c.orderIndex)) + 1 : 0;
  db.cards.push({ ...card, id, lessonId, createdAt: now, orderIndex: nextIndex });
  save(db);
  return id;
}

export function updateCard(cardId: UUID, patch: Partial<Card>) {
  const db = load();
  const idx = db.cards.findIndex((c) => c.id === cardId);
  if (idx === -1) return;
  db.cards[idx] = { ...db.cards[idx], ...patch };
  save(db);
}

export function deleteCard(cardId: UUID) {
  const db = load();
  db.cards = db.cards.filter((c) => c.id !== cardId);
  db.progress = db.progress.filter((p) => p.cardId !== cardId);
  save(db);
}

export function reorderCards(lessonId: UUID, orderedIds: UUID[]) {
  const db = load();
  const map = new Map(orderedIds.map((id, idx) => [id, idx] as const));
  db.cards = db.cards.map((c) =>
    c.lessonId === lessonId && map.has(c.id) ? { ...c, orderIndex: map.get(c.id)! } : c
  );
  save(db);
}

export function saveProgress(input: Progress) {
  const db = load();
  const idx = db.progress.findIndex((p) => p.cardId === input.cardId);
  if (idx === -1) db.progress.push(input);
  else db.progress[idx] = input;
  save(db);
}

export function getProgress(cardId: UUID): Progress | undefined {
  return load().progress.find((p) => p.cardId === cardId);
}

// AI drafts (mock only)
export function saveDraft(kind: AiDraft["kind"], payload: CoursePlan | LessonCards): AiDraft {
  const db = load();
  const draft: AiDraft = { id: uuid(), kind, payload, createdAt: nowIso() };
  db.drafts = db.drafts.filter((d) => d.kind !== kind); // keep latest per kind
  db.drafts.push(draft);
  save(db);
  return draft;
}

export function getDraft(id: string): AiDraft | undefined {
  return load().drafts.find((d) => d.id === id);
}

export function commitCoursePlan(draftId: string): { courseId: UUID } | undefined {
  const db = load();
  const draft = db.drafts.find((d) => d.id === draftId && d.kind === "outline");
  if (!draft) return undefined;
  const plan = draft.payload as CoursePlan;
  const { courseId } = createCourse({
    title: plan.course.title,
    description: plan.course.description,
    category: plan.course.category,
  });
  plan.lessons.forEach((l) => addLesson(courseId, l.title));
  // Remove draft after commit
  const latest = load();
  latest.drafts = latest.drafts.filter((d) => d.id !== draftId);
  save(latest);
  return { courseId };
}

export function commitLessonCards(opts: {
  draftId: string;
  lessonId: UUID;
}): { count: number } | undefined {
  const db = load();
  const draft = db.drafts.find((d) => d.id === opts.draftId && d.kind === "lesson-cards");
  if (!draft) return undefined;
  const payload = draft.payload as LessonCards;
  const items = payload.cards;
  let count = 0;
  for (const item of items) {
    if (item.type === "text") {
      addCard(opts.lessonId, {
        cardType: "text",
        title: item.title ?? null,
        content: { body: item.body },
      });
      count++;
    } else if (item.type === "quiz") {
      addCard(opts.lessonId, {
        cardType: "quiz",
        title: item.title ?? null,
        content: {
          question: item.question,
          options: item.options,
          answerIndex: item.answerIndex,
          explanation: item.explanation ?? undefined,
        },
      });
      count++;
    } else if (item.type === "fill-blank") {
      addCard(opts.lessonId, {
        cardType: "fill-blank",
        title: item.title ?? null,
        content: {
          text: item.text,
          answers: item.answers,
          caseSensitive: item.caseSensitive ?? false,
        },
      });
      count++;
    }
  }
  const latest = load();
  latest.drafts = latest.drafts.filter((d) => d.id !== opts.draftId);
  save(latest);
  return { count };
}
