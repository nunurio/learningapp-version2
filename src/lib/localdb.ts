"use client";
import * as React from "react";

import type {
  AiDraft,
  Card,
  Course,
  Lesson,
  LessonCards,
  Progress,
  UUID,
  CoursePlan,
  SrsEntry,
  SrsRating,
} from "./types";

const STORAGE_KEY = "learnify_v1";
const POKE_KEY = "__learnify_poke__";

// --- Lightweight pub/sub for UI reactivity ---------------------------------
let __dbVersion = 0;
const __listeners = new Set<() => void>();
let __bc: BroadcastChannel | null = null;

function __notifyDbChange() {
  __dbVersion++;
  __listeners.forEach((l) => {
    try { l(); } catch {}
  });
  try { window.dispatchEvent(new Event("learnify:db-change")); } catch {}
  try { localStorage.setItem(POKE_KEY, String(Date.now())); } catch {}
  try { __bc?.postMessage({ type: "db-change", v: __dbVersion }); } catch {}
}

if (typeof window !== "undefined") {
  try { __bc = new BroadcastChannel("learnify_sync"); } catch {}
  if (__bc) {
    __bc.onmessage = (ev) => {
      if (ev?.data?.type === "db-change") {
        // keep monotonic, then notify
        __dbVersion = Math.max(__dbVersion, Number(ev.data.v) || 0);
        __listeners.forEach((l) => { try { l(); } catch {} });
      }
    };
  }
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY || e.key === POKE_KEY) {
      __notifyDbChange();
    }
  });
}

export function subscribeLocalDb(listener: () => void): () => void {
  __listeners.add(listener);
  return () => { __listeners.delete(listener); };
}

export function useLocalDbVersion(): number {
  return React.useSyncExternalStore(subscribeLocalDb, () => __dbVersion, () => __dbVersion);
}

type DB = {
  courses: Course[];
  lessons: Lesson[];
  cards: Card[];
  progress: Progress[];
  drafts: AiDraft[];
  srs: SrsEntry[];
  flags: { cardId: UUID; flaggedAt: string }[];
  notes: { cardId: UUID; text: string; updatedAt: string }[];
};

function emptyDb(): DB {
  return { courses: [], lessons: [], cards: [], progress: [], drafts: [], srs: [], flags: [], notes: [] };
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
      srs: parsed.srs ?? [],
      flags: (parsed as any).flags ?? [],
      notes: (parsed as any).notes ?? [],
    };
  } catch {
    return emptyDb();
  }
}

function save(db: DB) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  __notifyDbChange();
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

// --- SRS helpers -----------------------------------------------------------
function startOfDayISO(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function getSrs(cardId: UUID): SrsEntry | undefined {
  return load().srs.find((s) => s.cardId === cardId);
}

export function rateSrs(cardId: UUID, rating: SrsRating): SrsEntry {
  const db = load();
  const now = new Date();
  const prev = db.srs.find((s) => s.cardId === cardId);
  let ease = prev?.ease ?? 2.5;
  let interval = prev?.interval ?? 0;

  switch (rating) {
    case "again":
      ease = Math.max(1.3, ease - 0.2);
      interval = 0;
      break;
    case "hard":
      ease = Math.max(1.3, ease - 0.15);
      interval = interval > 0 ? Math.max(1, Math.round(interval * 1.2)) : 0;
      break;
    case "good":
      interval = interval > 0 ? Math.max(1, Math.round(interval * ease)) : 1;
      ease = Math.max(1.3, Math.min(3.0, ease));
      break;
    case "easy":
      interval = interval > 0 ? Math.max(1, Math.round(interval * ease * 1.3)) : 3;
      ease = Math.min(3.0, ease + 0.1);
      break;
  }

  const due = startOfDayISO(new Date(now.getTime() + interval * 24 * 60 * 60 * 1000));
  const next: SrsEntry = { cardId, ease, interval, due, lastRating: rating };
  if (!prev) db.srs.push(next);
  else db.srs[db.srs.indexOf(prev)] = next;
  save(db);
  return next;
}

// --- Flags & Notes ---------------------------------------------------------
export function isFlagged(cardId: UUID): boolean {
  return load().flags.some((f) => f.cardId === cardId);
}

export function toggleFlag(cardId: UUID): boolean {
  const db = load();
  const idx = db.flags.findIndex((f) => f.cardId === cardId);
  if (idx === -1) {
    db.flags.push({ cardId, flaggedAt: nowIso() });
    save(db);
    return true;
  } else {
    db.flags.splice(idx, 1);
    save(db);
    return false;
  }
}

export function saveNote(cardId: UUID, text: string) {
  const db = load();
  const idx = db.notes.findIndex((n) => n.cardId === cardId);
  const row = { cardId, text, updatedAt: nowIso() };
  if (idx === -1) db.notes.push(row);
  else db.notes[idx] = row;
  save(db);
}

export function getNote(cardId: UUID): string | undefined {
  return load().notes.find((n) => n.cardId === cardId)?.text;
}

export function listFlaggedByCourse(courseId: UUID): UUID[] {
  const db = load();
  const lessonIds = db.lessons.filter((l) => l.courseId === courseId).map((l) => l.id);
  const cardIds = db.cards.filter((c) => lessonIds.includes(c.lessonId)).map((c) => c.id);
  const set = new Set(cardIds);
  return db.flags.filter((f) => set.has(f.cardId)).map((f) => f.cardId);
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

export function commitCoursePlanPartial(draftId: string, selectedIndexes: number[]): { courseId: UUID } | undefined {
  const db = load();
  const draft = db.drafts.find((d) => d.id === draftId && d.kind === "outline");
  if (!draft) return undefined;
  const plan = draft.payload as CoursePlan;
  const { courseId } = createCourse({
    title: plan.course.title,
    description: plan.course.description,
    category: plan.course.category,
  });
  const set = new Set(selectedIndexes);
  plan.lessons.forEach((l, idx) => {
    if (set.has(idx)) addLesson(courseId, l.title);
  });
  const latest = load();
  latest.drafts = latest.drafts.filter((d) => d.id !== draftId);
  save(latest);
  return { courseId };
}

export function commitLessonCards(opts: {
  draftId: string;
  lessonId: UUID;
}): { count: number; cardIds: UUID[] } | undefined {
  const db = load();
  const draft = db.drafts.find((d) => d.id === opts.draftId && d.kind === "lesson-cards");
  if (!draft) return undefined;
  const payload = draft.payload as LessonCards;
  const items = payload.cards;
  let count = 0;
  const cardIds: UUID[] = [];
  for (const item of items) {
    if (item.type === "text") {
      const id = addCard(opts.lessonId, {
        cardType: "text",
        title: item.title ?? null,
        content: { body: item.body },
      });
      cardIds.push(id); count++;
    } else if (item.type === "quiz") {
      const id = addCard(opts.lessonId, {
        cardType: "quiz",
        title: item.title ?? null,
        content: {
          question: item.question,
          options: item.options,
          answerIndex: item.answerIndex,
          explanation: item.explanation ?? undefined,
        },
      });
      cardIds.push(id); count++;
    } else if (item.type === "fill-blank") {
      const id = addCard(opts.lessonId, {
        cardType: "fill-blank",
        title: item.title ?? null,
        content: {
          text: item.text,
          answers: item.answers,
          caseSensitive: item.caseSensitive ?? false,
        },
      });
      cardIds.push(id); count++;
    }
  }
  const latest = load();
  latest.drafts = latest.drafts.filter((d) => d.id !== opts.draftId);
  save(latest);
  return { count, cardIds };
}

export function commitLessonCardsPartial(opts: {
  draftId: string;
  lessonId: UUID;
  selectedIndexes: number[];
}): { count: number; cardIds: UUID[] } | undefined {
  const db = load();
  const draft = db.drafts.find((d) => d.id === opts.draftId && d.kind === "lesson-cards");
  if (!draft) return undefined;
  const payload = draft.payload as LessonCards;
  const items = payload.cards;
  const set = new Set(opts.selectedIndexes);
  let count = 0;
  const cardIds: UUID[] = [];
  items.forEach((item, idx) => {
    if (!set.has(idx)) return;
    if (item.type === "text") {
      const id = addCard(opts.lessonId, {
        cardType: "text",
        title: item.title ?? null,
        content: { body: item.body },
      });
      cardIds.push(id); count++;
    } else if (item.type === "quiz") {
      const id = addCard(opts.lessonId, {
        cardType: "quiz",
        title: item.title ?? null,
        content: {
          question: item.question,
          options: item.options,
          answerIndex: item.answerIndex,
          explanation: item.explanation ?? undefined,
        },
      });
      cardIds.push(id); count++;
    } else if (item.type === "fill-blank") {
      const id = addCard(opts.lessonId, {
        cardType: "fill-blank",
        title: item.title ?? null,
        content: {
          text: item.text,
          answers: item.answers,
          caseSensitive: item.caseSensitive ?? false,
        },
      });
      cardIds.push(id); count++;
    }
  });
  const latest = load();
  latest.drafts = latest.drafts.filter((d) => d.id !== opts.draftId);
  save(latest);
  return { count, cardIds };
}

export function deleteCards(ids: UUID[]) {
  const db = load();
  const set = new Set(ids);
  db.cards = db.cards.filter((c) => !set.has(c.id));
  db.progress = db.progress.filter((p) => !set.has(p.cardId));
  save(db);
}
