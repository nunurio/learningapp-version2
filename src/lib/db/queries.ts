import { createClient, getCurrentUserId } from "@/lib/supabase/server";
import type { Course, Lesson, Card, Progress, UUID, SrsEntry, Note } from "@/lib/types";
import type { Tables } from "@/lib/database.types";
import { mapCourse, mapLesson, mapCard } from "@/lib/db/mappers";

// All functions here run on the server and use the authenticated
// Supabase session (RLS enforced).

// Row→ドメイン変換は mappers.ts に集約

export async function listCourses(): Promise<Course[]> {
  const supa = await createClient();
  const { data, error } = await supa
    .from("courses")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapCourse);
}

export async function getCourse(courseId: UUID): Promise<Course | undefined> {
  const supa = await createClient();
  const { data, error } = await supa
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapCourse(data) : undefined;
}

export async function listLessons(courseId: UUID): Promise<Lesson[]> {
  const supa = await createClient();
  const { data, error } = await supa
    .from("lessons")
    .select("*")
    .eq("course_id", courseId)
    .order("order_index")
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map(mapLesson);
}

export async function listCards(lessonId: UUID): Promise<Card[]> {
  const supa = await createClient();
  const { data, error } = await supa
    .from("cards")
    .select("*")
    .eq("lesson_id", lessonId)
    .order("order_index")
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map(mapCard);
}

export async function listFlaggedByCourse(courseId: UUID): Promise<UUID[]> {
  const supa = await createClient();
  const { data, error } = await supa
    .from("flags")
    .select("card_id, cards!inner(lesson_id, lessons!inner(course_id))")
    .eq("cards.lessons.course_id", courseId);
  if (error) throw error;
  return (data ?? []).map((r: { card_id: UUID }) => r.card_id);
}

export async function getProgress(cardId: UUID): Promise<Progress | undefined> {
  const supa = await createClient();
  const { data, error } = await supa
    .from("progress")
    .select("*")
    .eq("card_id", cardId)
    .maybeSingle();
  if (error) throw error;
  return data
    ? {
        cardId: data.card_id,
        completed: data.completed,
        completedAt: data.completed_at ?? undefined,
        answer: data.answer ?? undefined,
      }
    : undefined;
}

export async function listNotes(cardId: UUID): Promise<Note[]> {
  const supa = await createClient();
  const { data, error } = await supa
    .from("notes")
    .select("id, card_id, text, created_at, updated_at")
    .eq("card_id", cardId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id as UUID,
    cardId: row.card_id as UUID,
    text: row.text,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function snapshot() {
  const supa = await createClient();

  const [coursesRes, lessonsRes, cardsRes, progressRes, flagsRes, notesRes] = await Promise.all([
    supa.from("courses").select("*"),
    supa.from("lessons").select("*"),
    supa.from("cards").select("*"),
    supa.from("progress").select("*"),
    supa.from("flags").select("*"),
    supa.from("notes").select("*"),
  ]);

  // Supabase select() responses return an array or null
  type ResultArr<T> = { data: T[] | null; error: unknown };
  const dataOrThrow = <T,>(r: ResultArr<T>): T[] => {
    if (r.error) {
      // Preserve PostgrestError properties for better debugging
      if (r.error && typeof r.error === "object" && "message" in r.error) {
        throw r.error;
      }
      throw new Error(String(r.error));
    }
    // When no rows, return a typed empty array
    return (r.data ?? []) as T[];
  };

  const courses = dataOrThrow<Tables<"courses">>(coursesRes).map(mapCourse);
  const lessons = dataOrThrow<Tables<"lessons">>(lessonsRes).map(mapLesson);
  const cards = dataOrThrow<Tables<"cards">>(cardsRes).map(mapCard);

  type ProgressRow = Tables<"progress">;
  type FlagRow = Tables<"flags">;
  type NoteRow = Tables<"notes">;
  const progress = dataOrThrow<ProgressRow>(progressRes).map((p) => ({
    cardId: p.card_id,
    completed: p.completed,
    completedAt: p.completed_at ?? undefined,
    answer: p.answer ?? undefined,
  }));
  const flags = dataOrThrow<FlagRow>(flagsRes).map((f) => ({ cardId: f.card_id, flaggedAt: f.flagged_at }));
  const notes = dataOrThrow<NoteRow>(notesRes).map((n) => ({
    id: n.id as UUID,
    cardId: n.card_id,
    text: n.text,
    createdAt: n.created_at,
    updatedAt: n.updated_at,
  } satisfies Note));

  return { courses, lessons, cards, progress, flags, notes };
}

export async function upsertSrs(entry: SrsEntry): Promise<SrsEntry> {
  const supa = await createClient();
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("Not authenticated");
  const { data, error } = await supa
    .from("srs")
    .upsert({
      user_id: userId,
      card_id: entry.cardId,
      ease: entry.ease,
      interval: entry.interval,
      due: entry.due.slice(0, 10),
      last_rating: entry.lastRating ?? null,
    })
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Failed to upsert SRS entry");
  return {
    cardId: data.card_id,
    ease: data.ease,
    interval: data.interval,
    due: new Date(data.due).toISOString(),
    lastRating: data.last_rating ?? undefined,
  } satisfies SrsEntry;
}
