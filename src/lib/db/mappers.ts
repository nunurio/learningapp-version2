import type { Tables } from "@/lib/database.types";
import type { Course, Lesson, Card } from "@/lib/types";

export function mapCourse(r: Tables<"courses">): Course {
  return {
    id: r.id,
    title: r.title,
    description: r.description ?? undefined,
    category: r.category ?? undefined,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function mapLesson(r: Tables<"lessons">): Lesson {
  return {
    id: r.id,
    courseId: r.course_id,
    title: r.title,
    orderIndex: r.order_index,
    createdAt: r.created_at,
  };
}

export function mapCard(r: Tables<"cards">): Card {
  return {
    id: r.id,
    lessonId: r.lesson_id,
    cardType: r.card_type,
    title: r.title ?? null,
    tags: r.tags,
    content: r.content as Card["content"],
    orderIndex: r.order_index,
    createdAt: r.created_at,
  };
}

