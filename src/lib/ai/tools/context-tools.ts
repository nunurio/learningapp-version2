import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { limitChars, redactText } from "@/lib/utils/redact";

export type ActiveRef = {
  courseId?: string;
  lessonId?: string;
  cardId?: string;
  mode?: "workspace" | "learn";
};

export const ActiveRefSchema = z
  .object({
    courseId: z.string().min(1).nullish(),
    lessonId: z.string().min(1).nullish(),
    cardId: z.string().min(1).nullish(),
    mode: z.enum(["workspace", "learn"]).nullish(),
  })
  .refine((ref) => Boolean(ref.courseId ?? ref.lessonId ?? ref.cardId), {
    message: "At least one of courseId, lessonId, or cardId is required.",
  })
  .transform((ref) => ({
    courseId: ref.courseId ?? undefined,
    lessonId: ref.lessonId ?? undefined,
    cardId: ref.cardId ?? undefined,
    mode: ref.mode ?? undefined,
  }));

export type ContextIncludeOptions = {
  neighbors: boolean;
  progress: boolean;
  flags: boolean;
  notes: boolean;
  maxBody: number;
};

const DEFAULT_INCLUDE: ContextIncludeOptions = {
  neighbors: true,
  progress: true,
  flags: true,
  notes: true,
  maxBody: 1200,
};

function resolveInclude(options?: Partial<ContextIncludeOptions>): ContextIncludeOptions {
  if (!options) return DEFAULT_INCLUDE;
  return {
    neighbors: options.neighbors ?? DEFAULT_INCLUDE.neighbors,
    progress: options.progress ?? DEFAULT_INCLUDE.progress,
    flags: options.flags ?? DEFAULT_INCLUDE.flags,
    notes: options.notes ?? DEFAULT_INCLUDE.notes,
    maxBody: options.maxBody ?? DEFAULT_INCLUDE.maxBody,
  };
}

function cloneJson(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object") return undefined;
  try {
    return structuredClone(value as Record<string, unknown>);
  } catch {
    try {
      return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
    } catch {
      return { ...(value as Record<string, unknown>) };
    }
  }
}

function trimCardContent(input: Record<string, unknown> | undefined, max: number) {
  if (!input) return undefined;
  const copy = { ...input };
  for (const key of ["body", "text", "explanation"] as const) {
    const raw = copy[key];
    if (typeof raw !== "string") continue;
    const limit = key === "explanation" ? Math.max(200, Math.floor(max / 2)) : max;
    copy[key] = limitChars(redactText(raw), limit);
  }
  return copy;
}

async function resolveRefHierarchy(
  supabase: SupabaseClient<Database>,
  ref: ActiveRef
): Promise<{
  card?: {
    id: string;
    lesson_id: string;
    card_type: Database["public"]["Enums"]["card_type"];
    title: string | null;
    tags: string[];
    order_index: number;
    content: unknown;
  } | null;
  lesson?: { id: string; course_id: string; title: string; order_index: number } | null;
  course?: { id: string; title: string | null; description: string | null; category: string | null } | null;
}> {
  let card: {
    id: string;
    lesson_id: string;
    card_type: Database["public"]["Enums"]["card_type"];
    title: string | null;
    tags: string[];
    order_index: number;
    content: unknown;
  } | null = null;
  let lesson: { id: string; course_id: string; title: string; order_index: number } | null = null;
  let course: { id: string; title: string | null; description: string | null; category: string | null } | null = null;

  if (ref.cardId) {
    const { data, error } = await supabase
      .from("cards")
      .select("id, lesson_id, card_type, title, tags, order_index, content")
      .eq("id", ref.cardId)
      .maybeSingle();
    if (error) {
      throw new Error(`Failed to load card (${ref.cardId}): ${error.message}`);
    }
    card = data ?? null;
  }

  const lessonIdToFetch = ref.lessonId ?? card?.lesson_id;
  if (lessonIdToFetch) {
    const { data: lessonRow, error: lessonError } = await supabase
      .from("lessons")
      .select("id, course_id, title, order_index")
      .eq("id", lessonIdToFetch)
      .maybeSingle();
    if (lessonError) {
      throw new Error(`Failed to load lesson (${lessonIdToFetch}): ${lessonError.message}`);
    }
    lesson = lessonRow ?? null;
  }

  const courseIdToFetch = ref.courseId ?? lesson?.course_id;
  if (courseIdToFetch) {
    const { data: courseRow, error: courseError } = await supabase
      .from("courses")
      .select("id, title, description, category")
      .eq("id", courseIdToFetch)
      .maybeSingle();
    if (courseError) {
      throw new Error(`Failed to load course (${courseIdToFetch}): ${courseError.message}`);
    }
    course = courseRow ?? null;
  }

  return { card, lesson, course };
}

async function loadNeighbors(
  supabase: SupabaseClient<Database>,
  lessonId: string,
  cardId: string
): Promise<{ prevId?: string; nextId?: string } | undefined> {
  const { data, error } = await supabase
    .from("cards")
    .select("id, order_index, created_at")
    .eq("lesson_id", lessonId)
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    throw new Error(`Failed to load neighboring cards: ${error.message}`);
  }
  if (!Array.isArray(data) || !data.length) return undefined;
  const idx = data.findIndex((row) => row.id === cardId);
  if (idx === -1) return undefined;
  return {
    prevId: idx > 0 ? data[idx - 1]?.id : undefined,
    nextId: idx < data.length - 1 ? data[idx + 1]?.id : undefined,
  };
}

async function loadProgress(
  supabase: SupabaseClient<Database>,
  userId: string,
  cardId: string
) {
  const { data, error } = await supabase
    .from("progress")
    .select("card_id, completed, completed_at, answer")
    .eq("card_id", cardId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to load progress: ${error.message}`);
  }
  if (!data) return undefined;
  return {
    cardId: data.card_id,
    completed: data.completed,
    completedAt: data.completed_at,
    answer: data.answer ?? null,
  };
}

async function loadFlagged(
  supabase: SupabaseClient<Database>,
  userId: string,
  cardId: string
) {
  const { data, error } = await supabase
    .from("flags")
    .select("card_id")
    .eq("card_id", cardId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to load flag status: ${error.message}`);
  }
  return Boolean(data);
}

async function loadNote(
  supabase: SupabaseClient<Database>,
  userId: string,
  cardId: string
) {
  const { data, error } = await supabase
    .from("notes")
    .select("text")
    .eq("card_id", cardId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to load notes: ${error.message}`);
  }
  if (typeof data?.text !== "string") return undefined;
  return limitChars(redactText(data.text), 800);
}

export type ContextBundle = {
  ref: ActiveRef | null;
  card?: {
    id: string;
    lessonId: string;
    cardType: Database["public"]["Enums"]["card_type"];
    title: string | null;
    tags: string[];
    orderIndex: number;
    content?: Record<string, unknown>;
  };
  lesson?: {
    id: string;
    courseId: string;
    title: string;
    orderIndex: number;
  };
  course?: {
    id: string;
    title: string | null;
    description: string | null;
    category: string | null;
  };
  neighbors?: { prevId?: string; nextId?: string };
  progress?: {
    cardId: string;
    completed: boolean;
    completedAt: string | null;
    answer: unknown;
  };
  flagged: boolean;
  note?: string;
};

export type GetContextBundleOptions = {
  supabase: SupabaseClient<Database>;
  ref?: ActiveRef | null;
  userId?: string;
  include?: Partial<ContextIncludeOptions>;
};

export async function getContextBundle(options: GetContextBundleOptions): Promise<ContextBundle> {
  const { supabase, ref, userId, include } = options;
  const inc = resolveInclude(include);

  if (!ref) {
    return {
      ref: null,
      card: undefined,
      lesson: undefined,
      course: undefined,
      neighbors: undefined,
      progress: undefined,
      flagged: false,
      note: undefined,
    };
  }

  const parsedRef = ActiveRefSchema.parse(ref);
  const hierarchy = await resolveRefHierarchy(supabase, parsedRef);
  const { card, lesson, course } = hierarchy;

  if (parsedRef.cardId && !card) {
    throw new Error("Active card could not be found. It may have been deleted or you may not have access.");
  }

  const expectedLessonId = parsedRef.lessonId ?? card?.lesson_id ?? undefined;
  if (expectedLessonId && !lesson) {
    throw new Error(`Lesson (${expectedLessonId}) could not be found for the current context.`);
  }

  const expectedCourseId = parsedRef.courseId ?? lesson?.course_id ?? undefined;
  if (expectedCourseId && !course) {
    throw new Error(`Course (${expectedCourseId}) could not be found for the current context.`);
  }

  const normalizedRef: ActiveRef = {
    courseId: parsedRef.courseId ?? lesson?.course_id ?? course?.id ?? undefined,
    lessonId: parsedRef.lessonId ?? card?.lesson_id ?? lesson?.id ?? undefined,
    cardId: parsedRef.cardId ?? card?.id ?? undefined,
    mode: parsedRef.mode,
  };

  const neighbors = inc.neighbors && card && lesson
    ? await loadNeighbors(supabase, lesson.id, card.id)
    : undefined;

  const progress = card && inc.progress && userId ? await loadProgress(supabase, userId, card.id) : undefined;
  const flagged = card && inc.flags && userId ? await loadFlagged(supabase, userId, card.id) : false;
  const note = card && inc.notes && userId ? await loadNote(supabase, userId, card.id) : undefined;

  const safeCard = card
    ? {
        id: card.id,
        lessonId: card.lesson_id,
        cardType: card.card_type,
        title: card.title,
        tags: Array.isArray(card.tags) ? card.tags : [],
        orderIndex: card.order_index,
        content: trimCardContent(cloneJson(card.content), inc.maxBody),
      }
    : undefined;
  const safeLesson = lesson
    ? {
        id: lesson.id,
        courseId: lesson.course_id,
        title: lesson.title,
        orderIndex: lesson.order_index,
      }
    : undefined;
  const safeCourse = course
    ? {
        id: course.id,
        title: course.title,
        description: course.description,
        category: course.category,
      }
    : undefined;

  return {
    ref: normalizedRef,
    card: safeCard,
    lesson: safeLesson,
    course: safeCourse,
    neighbors,
    progress,
    flagged,
    note,
  };
}
