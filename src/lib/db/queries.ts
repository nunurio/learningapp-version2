import { createClient, getCurrentUserId } from "@/lib/supabase/server";
import type { Course, Lesson, Card, Progress, UUID, SrsEntry, CourseStatus, CardType } from "@/lib/types";

// All functions here run on the server and use the authenticated
// Supabase session (RLS enforced).

type CourseRow = {
  id: UUID;
  title: string;
  description: string | null;
  category: string | null;
  status: CourseStatus;
  created_at: string;
  updated_at: string;
};

type LessonRow = {
  id: UUID;
  course_id: UUID;
  title: string;
  order_index: number;
  created_at: string;
};

type CardRow = {
  id: UUID;
  lesson_id: UUID;
  card_type: CardType;
  title: string | null;
  tags: string[] | null;
  content: unknown;
  order_index: number;
  created_at: string;
};

const mapCourse = (r: CourseRow): Course => ({
  id: r.id,
  title: r.title,
  description: r.description ?? undefined,
  category: r.category ?? undefined,
  status: r.status,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const mapLesson = (r: LessonRow): Lesson => ({
  id: r.id,
  courseId: r.course_id,
  title: r.title,
  orderIndex: r.order_index,
  createdAt: r.created_at,
});

const mapCard = (r: CardRow): Card => ({
  id: r.id,
  lessonId: r.lesson_id,
  cardType: r.card_type,
  title: r.title ?? null,
  tags: r.tags ?? undefined,
  content: r.content as Card["content"],
  orderIndex: r.order_index,
  createdAt: r.created_at,
});

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

export async function getNote(cardId: UUID): Promise<string | undefined> {
  const supa = await createClient();
  const { data, error } = await supa
    .from("notes")
    .select("text")
    .eq("card_id", cardId)
    .maybeSingle();
  if (error) throw error;
  return data?.text ?? undefined;
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

  const courses = dataOrThrow<CourseRow>(coursesRes).map(mapCourse);
  const lessons = dataOrThrow<LessonRow>(lessonsRes).map(mapLesson);
  const cards = dataOrThrow<CardRow>(cardsRes).map(mapCard);

  type ProgressRow = { card_id: UUID; completed: boolean; completed_at: string | null; answer: unknown };
  type FlagRow = { card_id: UUID; flagged_at: string };
  type NoteRow = { card_id: UUID; text: string; updated_at: string };
  const progress = dataOrThrow<ProgressRow>(progressRes).map((p) => ({
    cardId: p.card_id,
    completed: p.completed,
    completedAt: p.completed_at ?? undefined,
    answer: p.answer ?? undefined,
  }));
  const flags = dataOrThrow<FlagRow>(flagsRes).map((f) => ({ cardId: f.card_id, flaggedAt: f.flagged_at }));
  const notes = dataOrThrow<NoteRow>(notesRes).map((n) => ({ cardId: n.card_id, text: n.text, updatedAt: n.updated_at }));

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
