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

// --- Client cache + pub/sub (no localStorage persistence) ------------------
let __dbVersion = 0;
const __listeners = new Set<() => void>();
let __bc: BroadcastChannel | null = null;

type DB = {
  courses: Course[];
  lessons: Lesson[];
  cards: Card[];
  progress: Progress[];
  srs: SrsEntry[];
  flags: { cardId: UUID; flaggedAt: string }[];
  notes: { cardId: UUID; text: string; updatedAt: string }[];
};

function emptyDb(): DB {
  return { courses: [], lessons: [], cards: [], progress: [], srs: [], flags: [], notes: [] };
}

let __db: DB = emptyDb();

function __notifyDbChange() {
  __dbVersion++;
  __listeners.forEach((l) => { try { l(); } catch {} });
  try { __bc?.postMessage({ type: "db-change", v: __dbVersion }); } catch {}
}

if (typeof window !== "undefined") {
  try { __bc = new BroadcastChannel("learnify_sync"); } catch {}
  if (__bc) {
    __bc.onmessage = (ev) => {
      if (ev?.data?.type === "db-change") {
        __dbVersion = Math.max(__dbVersion, Number(ev.data.v) || 0);
        __listeners.forEach((l) => { try { l(); } catch {} });
      }
    };
  }
  // Initial sync
  void refreshAll();
}

export function subscribeLocalDb(listener: () => void): () => void {
  __listeners.add(listener);
  return () => { __listeners.delete(listener); };
}

export function useLocalDbVersion(): number {
  return React.useSyncExternalStore(subscribeLocalDb, () => __dbVersion, () => __dbVersion);
}

async function api<T = unknown>(op: string, params?: unknown): Promise<T> {
  const res = await fetch("/api/db", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ op, params }),
  });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as T;
}

export async function refreshAll() {
  const snap = await api<DB & { notes: { cardId: UUID; text: string; updatedAt: string } }>("snapshot");
  __db = { ...__db, ...snap };
  __notifyDbChange();
}

// ----- Reads (sync from cache) --------------------------------------------
export function listCourses(): Course[] {
  return [...__db.courses].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getCourse(courseId: UUID): Course | undefined {
  return __db.courses.find((c) => c.id === courseId);
}

export function listLessons(courseId: UUID): Lesson[] {
  return __db.lessons
    .filter((l) => l.courseId === courseId)
    .sort((a, b) => a.orderIndex - b.orderIndex || a.createdAt.localeCompare(b.createdAt));
}

export function listCards(lessonId: UUID): Card[] {
  return __db.cards
    .filter((c) => c.lessonId === lessonId)
    .sort((a, b) => a.orderIndex - b.orderIndex || a.createdAt.localeCompare(b.createdAt));
}

export function getProgress(cardId: UUID): Progress | undefined {
  return __db.progress.find((p) => p.cardId === cardId);
}

export function isFlagged(cardId: UUID): boolean {
  return __db.flags.some((f) => f.cardId === cardId);
}

export function getNote(cardId: UUID): string | undefined {
  return __db.notes.find((n) => n.cardId === cardId)?.text;
}

export function listFlaggedByCourse(courseId: UUID): UUID[] {
  const lessonIds = __db.lessons.filter((l) => l.courseId === courseId).map((l) => l.id);
  const cardIds = __db.cards.filter((c) => lessonIds.includes(c.lessonId)).map((c) => c.id);
  const set = new Set(cardIds);
  return __db.flags.filter((f) => set.has(f.cardId)).map((f) => f.cardId);
}

// ----- Writes (async, then refresh cache) ---------------------------------
export async function createCourse(input: { title: string; description?: string; category?: string }): Promise<{ courseId: UUID }> {
  const res = await api<{ courseId: UUID }>("createCourse", input);
  await refreshAll();
  return res;
}

export async function updateCourse(courseId: UUID, patch: Partial<Course>): Promise<void> {
  await api("updateCourse", { courseId, patch });
  await refreshAll();
}

export async function deleteCourse(courseId: UUID): Promise<void> {
  await api("deleteCourse", { courseId });
  await refreshAll();
}

export async function addLesson(courseId: UUID, title: string): Promise<{ lessonId: UUID }> {
  const res = await api<{ lessonId: UUID }>("addLesson", { courseId, title });
  await refreshAll();
  return res;
}

export async function deleteLesson(lessonId: UUID): Promise<void> {
  await api("deleteLesson", { lessonId });
  await refreshAll();
}

export async function reorderLessons(courseId: UUID, orderedIds: UUID[]): Promise<void> {
  await api("reorderLessons", { courseId, orderedIds });
  await refreshAll();
}

export async function addCard(
  lessonId: UUID,
  card: Omit<Card, "id" | "lessonId" | "createdAt" | "orderIndex">
): Promise<UUID> {
  const { id } = await api<{ id: UUID }>("addCard", { lessonId, card });
  await refreshAll();
  return id;
}

export async function updateCard(cardId: UUID, patch: Partial<Card>): Promise<void> {
  await api("updateCard", { cardId, patch });
  await refreshAll();
}

export async function deleteCard(cardId: UUID): Promise<void> {
  await api("deleteCard", { cardId });
  await refreshAll();
}

export async function deleteCards(ids: UUID[]): Promise<void> {
  await api("deleteCards", { ids });
  await refreshAll();
}

export async function reorderCards(lessonId: UUID, orderedIds: UUID[]): Promise<void> {
  await api("reorderCards", { lessonId, orderedIds });
  await refreshAll();
}

export async function saveProgress(input: Progress): Promise<void> {
  await api("saveProgress", { input });
  const idx = __db.progress.findIndex((p) => p.cardId === input.cardId);
  if (idx === -1) __db.progress.push(input); else __db.progress[idx] = input;
  __notifyDbChange();
}

export async function rateSrs(cardId: UUID, rating: SrsRating): Promise<SrsEntry> {
  const entry = await api<SrsEntry>("rateSrs", { cardId, rating });
  const idx = __db.srs.findIndex((s) => s.cardId === cardId);
  if (idx === -1) __db.srs.push(entry); else __db.srs[idx] = entry;
  __notifyDbChange();
  return entry;
}

export async function toggleFlag(cardId: UUID): Promise<boolean> {
  const { on } = await api<{ on: boolean }>("toggleFlag", { cardId });
  const idx = __db.flags.findIndex((f) => f.cardId === cardId);
  if (on && idx === -1) __db.flags.push({ cardId, flaggedAt: new Date().toISOString() });
  if (!on && idx !== -1) __db.flags.splice(idx, 1);
  __notifyDbChange();
  return on;
}

export async function saveNote(cardId: UUID, text: string): Promise<void> {
  await api("saveNote", { cardId, text });
  const idx = __db.notes.findIndex((n) => n.cardId === cardId);
  const row = { cardId, text, updatedAt: new Date().toISOString() };
  if (idx === -1) __db.notes.push(row); else __db.notes[idx] = row;
  __notifyDbChange();
}

// ----- AI drafts backed by DB ---------------------------------------------
export async function saveDraft(kind: AiDraft["kind"], payload: CoursePlan | LessonCards): Promise<AiDraft> {
  const res = await api<{ id: string }>("saveDraft", { kind, payload });
  return { id: res.id, kind, payload, createdAt: new Date().toISOString() };
}

export async function commitCoursePlan(draftId: string): Promise<{ courseId: UUID } | undefined> {
  const res = await api<{ courseId: UUID } | null>("commitCoursePlan", { draftId });
  await refreshAll();
  return res ?? undefined;
}

export async function commitCoursePlanPartial(draftId: string, selectedIndexes: number[]): Promise<{ courseId: UUID } | undefined> {
  const res = await api<{ courseId: UUID } | null>("commitCoursePlanPartial", { draftId, selectedIndexes });
  await refreshAll();
  return res ?? undefined;
}

export async function commitLessonCards(opts: { draftId: string; lessonId: UUID }): Promise<{ count: number; cardIds: UUID[] } | undefined> {
  const res = await api<{ count: number; cardIds: UUID[] } | null>("commitLessonCards", opts);
  await refreshAll();
  return res ?? undefined;
}

export async function commitLessonCardsPartial(opts: { draftId: string; lessonId: UUID; selectedIndexes: number[] }): Promise<{ count: number; cardIds: UUID[] } | undefined> {
  const res = await api<{ count: number; cardIds: UUID[] } | null>("commitLessonCardsPartial", opts);
  await refreshAll();
  return res ?? undefined;
}
