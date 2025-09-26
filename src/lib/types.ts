export type UUID = string;
import type { Enums } from "@/lib/database.types";

export type CourseStatus = Enums<"course_status">;

export type Course = {
  id: UUID;
  title: string;
  description?: string;
  category?: string;
  level?: string;
  status: CourseStatus;
  createdAt: string; // ISO
  updatedAt: string; // ISO
};

export type Lesson = {
  id: UUID;
  courseId: UUID;
  title: string;
  orderIndex: number;
  createdAt: string; // ISO
};

export type CardType = Enums<"card_type">;

export type TextCardContent = {
  body: string;
};

export type QuizCardContent = {
  question: string;
  options: string[];
  answerIndex: number;
  explanation?: string | null;
  optionExplanations?: (string | null)[] | null;
  hint?: string | null;
};

export type FillBlankCardContent = {
  text: string; // use [[1]] placeholders
  answers: Record<string, string>; // key is number as string
  caseSensitive?: boolean;
};

export type Card = {
  id: UUID;
  lessonId: UUID;
  cardType: CardType;
  title?: string | null;
  tags?: string[]; // optional labels for filtering/UX
  content: TextCardContent | QuizCardContent | FillBlankCardContent;
  orderIndex: number;
  createdAt: string; // ISO
};

export type Progress = {
  cardId: UUID;
  completed: boolean;
  completedAt?: string; // ISO
  answer?: unknown;
};

export type Note = {
  id: UUID;
  cardId: UUID;
  text: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
};

// Simple local SRS (Spaced Repetition) model
export type SrsRating = Enums<"srs_rating">;
export type SrsEntry = {
  cardId: UUID;
  ease: number; // 1.3–3.0 range
  interval: number; // days
  due: string; // ISO date (midnight)
  lastRating?: SrsRating;
};

// AI preview payloads (local mock only)
export type CoursePlan = {
  course: {
    title: string;
    description?: string | null;
    category?: string | null;
    level?: string | null;
  };
  lessons: { title: string; summary?: string | null }[];
};

export type LessonCards = {
  lessonTitle: string;
  cards: (
    | { type: 'text'; title?: string | null; body: string }
    | {
        type: 'quiz';
        title?: string | null;
        question: string;
        options: string[];
        answerIndex: number;
        explanation?: string | null;
        optionExplanations?: (string | null)[] | null;
        hint?: string | null;
      }
    | {
        type: 'fill-blank';
        title?: string | null;
        text: string;
        answers: Record<string, string>;
        caseSensitive?: boolean | null;
      }
  )[];
};

export type AiDraft = {
  id: string;
  kind: 'outline' | 'lesson-cards';
  payload: CoursePlan | LessonCards;
  createdAt: string; // ISO
};

// --- Chat ------------------------------------------------------------
export type ChatThread = {
  id: UUID;
  title: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  lastMessageSnippet?: string;
};

export type ChatMessage = {
  id: UUID;
  threadId: UUID;
  role: "user" | "assistant";
  content: string;
  createdAt: string; // ISO
};
