import { z } from "zod";
import { createClient, getCurrentUserId } from "@/lib/supabase/server";
import { unstable_cache } from "next/cache";
import type { Tables } from "@/lib/database.types";
import type { CourseStatus, UUID } from "@/lib/types";

// Server-only aggregated query for the dashboard
// Gathers: courses + counts, SRS (today/overdue/7days), last activity

type UpcomingBucket = { date: string; count: number };

export type CourseSummary = {
  id: UUID;
  title: string;
  description?: string;
  status: CourseStatus;
  updatedAt: string; // ISO
  totalLessons: number;
  totalCards: number;
  completedCards: number;
  flaggedCards: number;
  completionRate: number; // 0..100
};

export type DashboardSummary = {
  stats: {
    totals: { courses: number; lessons: number; cards: number; completedCards: number };
    srs: { todayDue: number; overdue: number; upcoming7: UpcomingBucket[] };
  };
  continueLearning?: { courseId: UUID; lessonId: UUID; cardId: UUID; lastActivityAt: string };
  courses: CourseSummary[];
  recentActivities: { type: string; occurredAt: string; id: string }[];
};

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDateStr(d: Date) {
  // YYYY-MM-DD; we keep local-day to align with typical study rhythm
  return d.toISOString().slice(0, 10);
}

export const DASHBOARD_TAG = "dashboard" as const;
export const dashboardUserTag = (userId: string) => `${DASHBOARD_TAG}:${userId}` as const;

async function computeDashboardSummary(supa: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<DashboardSummary> {

  const today = startOfDay();
  const todayStr = toDateStr(today);
  const in7 = new Date(today);
  in7.setDate(in7.getDate() + 7);
  const in7Str = toDateStr(in7);

  // Fetch all needed data in parallel (RLS applies by user)
  const [coursesRes, lessonsRes, cardsRes, progressRes, flagsRes, srsTodayRes, srsOverdueRes, srsUpcomingRes] = await Promise.all([
    supa.from("courses").select("*").order("updated_at", { ascending: false }),
    supa.from("lessons").select("*"),
    supa.from("cards").select("*"),
    supa
      .from("progress")
      .select("*")
      .eq("user_id", userId),
    supa
      .from("flags")
      .select("*")
      .eq("user_id", userId),
    supa
      .from("srs")
      .select("card_id")
      .eq("user_id", userId)
      .eq("due", todayStr),
    supa
      .from("srs")
      .select("card_id")
      .eq("user_id", userId)
      .lt("due", todayStr),
    supa
      .from("srs")
      .select("due")
      .eq("user_id", userId)
      .gt("due", todayStr)
      .lte("due", in7Str),
  ]);

  const dataOrThrow = <T,>(r: { data: T[] | null; error: unknown }) => {
    if (r.error) {
      if (r.error && typeof r.error === "object" && "message" in r.error) throw r.error;
      throw new Error(String(r.error));
    }
    return (r.data ?? []) as T[];
  };

  type CourseRow = Tables<"courses">;
  type LessonRow = Tables<"lessons">;
  type CardRow = Tables<"cards">;
  type ProgressRow = Tables<"progress">;
  type FlagRow = Tables<"flags">;
  type SrsRow = Tables<"srs">;

  const courses = dataOrThrow<CourseRow>(coursesRes);
  const lessons = dataOrThrow<LessonRow>(lessonsRes);
  const cards = dataOrThrow<CardRow>(cardsRes);
  const progress = dataOrThrow<ProgressRow>(progressRes);
  const flags = dataOrThrow<FlagRow>(flagsRes);
  const srsToday = dataOrThrow<Pick<SrsRow, "card_id">>(srsTodayRes);
  const srsOverdue = dataOrThrow<Pick<SrsRow, "card_id">>(srsOverdueRes);
  const srsUpcoming = dataOrThrow<Pick<SrsRow, "due">>(srsUpcomingRes);

  // Build lookup maps
  const lessonById = new Map<string, LessonRow>();
  for (const l of lessons) lessonById.set(l.id, l);
  const cardById = new Map<string, CardRow>();
  for (const c of cards) cardById.set(c.id, c);

  // Aggregate counts per course
  const courseAgg = new Map<string, { lessons: number; cards: number; completed: number; flagged: number }>();
  const ensure = (courseId: string) => {
    let v = courseAgg.get(courseId);
    if (!v) {
      v = { lessons: 0, cards: 0, completed: 0, flagged: 0 };
      courseAgg.set(courseId, v);
    }
    return v;
  };

  // lessons per course
  for (const l of lessons) ensure(l.course_id).lessons++;

  // cards per course
  for (const c of cards) {
    const l = lessonById.get(c.lesson_id);
    if (!l) continue;
    ensure(l.course_id).cards++;
  }

  // completed per course
  for (const p of progress) {
    if (!p.completed) continue;
    const card = cardById.get(p.card_id);
    if (!card) continue;
    const l = lessonById.get(card.lesson_id);
    if (!l) continue;
    ensure(l.course_id).completed++;
  }

  // flagged per course
  for (const f of flags) {
    const card = cardById.get(f.card_id);
    if (!card) continue;
    const l = lessonById.get(card.lesson_id);
    if (!l) continue;
    ensure(l.course_id).flagged++;
  }

  // upcoming7 series: materialize each day bucket
  const buckets: UpcomingBucket[] = [];
  for (let i = 1; i <= 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    buckets.push({ date: toDateStr(d), count: 0 });
  }
  const bucketIdx = new Map<string, number>();
  buckets.forEach((b, i) => bucketIdx.set(b.date, i));
  for (const r of srsUpcoming) {
    const idx = bucketIdx.get(r.due);
    if (idx == null) continue;
    buckets[idx].count += 1;
  }

  // continueLearning heuristic: latest completed_at or latest flag as fallback
  let continueLearning: DashboardSummary["continueLearning"] | undefined = undefined;
  const toTime = (s: string | null) => (s ? new Date(s).getTime() : 0);
  const latestProgress = progress
    .filter((p) => !!p.completed_at)
    .sort((a, b) => toTime(b.completed_at) - toTime(a.completed_at))[0];
  const latestFlag = flags.sort((a, b) => (a.flagged_at < b.flagged_at ? 1 : -1))[0];
  const pick = latestProgress?.completed_at ? { when: latestProgress.completed_at, cardId: latestProgress.card_id } : latestFlag ? { when: latestFlag.flagged_at, cardId: latestFlag.card_id } : undefined;
  if (pick && pick.when) {
    const card = cardById.get(pick.cardId);
    if (card) {
      const l = lessonById.get(card.lesson_id);
      if (l) {
        continueLearning = { courseId: l.course_id, lessonId: l.id, cardId: card.id, lastActivityAt: pick.when };
      }
    }
  }

  const courseSummaries: CourseSummary[] = courses.map((c) => {
    const agg = courseAgg.get(c.id) ?? { lessons: 0, cards: 0, completed: 0, flagged: 0 };
    const completionRate = agg.cards > 0 ? Math.round((agg.completed / agg.cards) * 100) : 0;
    return {
      id: c.id as UUID,
      title: c.title,
      description: c.description ?? undefined,
      status: c.status as CourseStatus,
      updatedAt: c.updated_at,
      totalLessons: agg.lessons,
      totalCards: agg.cards,
      completedCards: agg.completed,
      flaggedCards: agg.flagged,
      completionRate,
    } satisfies CourseSummary;
  });

  const totals = {
    courses: courses.length,
    lessons: lessons.length,
    cards: cards.length,
    completedCards: progress.filter((p) => p.completed).length,
  } as const;

  const srs = {
    todayDue: srsToday.length,
    overdue: srsOverdue.length,
    upcoming7: buckets,
  } as const;

  // Validate lightly to ensure stable shape
  const schema = z.object({
    stats: z.object({
      totals: z.object({ courses: z.number(), lessons: z.number(), cards: z.number(), completedCards: z.number() }),
      srs: z.object({
        todayDue: z.number(),
        overdue: z.number(),
        upcoming7: z.array(z.object({ date: z.string(), count: z.number() })),
      }),
    }),
    continueLearning: z
      .object({ courseId: z.string(), lessonId: z.string(), cardId: z.string(), lastActivityAt: z.string() })
      .optional(),
    courses: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        description: z.string().optional(),
        status: z.any(),
        updatedAt: z.string(),
        totalLessons: z.number(),
        totalCards: z.number(),
        completedCards: z.number(),
        flaggedCards: z.number(),
        completionRate: z.number(),
      })
    ),
    recentActivities: z.array(z.object({ type: z.string(), occurredAt: z.string(), id: z.string() })),
  });

  const parsed = schema.parse({
    stats: { totals, srs },
    continueLearning,
    courses: courseSummaries,
    recentActivities: [],
  });

  return parsed as DashboardSummary;
}

// Non-cached (direct) getter — useful for tests or fully dynamic views
export async function getDashboardSummary(): Promise<DashboardSummary> {
  const supa = await createClient();
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("Not authenticated");
  return await computeDashboardSummary(supa, userId);
}

// Cached getter with per-user key and tag; avoids cookies() inside the cached scope
export async function getDashboardSummaryCached(): Promise<DashboardSummary> {
  const supa = await createClient();
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("Not authenticated");
  const cached = unstable_cache(
    () => computeDashboardSummary(supa, userId),
    [DASHBOARD_TAG, userId],
    { revalidate: 60, tags: [dashboardUserTag(userId)] }
  );
  return await cached();
}
