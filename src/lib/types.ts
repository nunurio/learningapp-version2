export type UUID = string;

export type CourseStatus = 'draft' | 'published';

export type Course = {
  id: UUID;
  title: string;
  description?: string;
  category?: string;
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

export type CardType = 'text' | 'quiz' | 'fill-blank';

export type TextCardContent = {
  body: string;
};

export type QuizCardContent = {
  question: string;
  options: string[];
  answerIndex: number;
  explanation?: string | null;
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

// AI preview payloads (local mock only)
export type CoursePlan = {
  course: {
    title: string;
    description?: string;
    category?: string;
  };
  lessons: { title: string; summary?: string }[];
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
      }
    | {
        type: 'fill-blank';
        title?: string | null;
        text: string;
        answers: Record<string, string>;
        caseSensitive?: boolean;
      }
  )[];
};

export type AiDraft = {
  id: string;
  kind: 'outline' | 'lesson-cards';
  payload: CoursePlan | LessonCards;
  createdAt: string; // ISO
};

