import { z } from "zod";

// CoursePlan schema (must mirror src/lib/types.ts)
export const CoursePlanSchema = z.object({
  course: z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    category: z.string().optional(),
  }),
  lessons: z
    .array(
      z.object({
        title: z.string().min(1),
        summary: z.string().optional(),
      })
    )
    .min(3)
    .max(30),
});

export type CoursePlanOutput = z.infer<typeof CoursePlanSchema>;

// LessonCards schema (must mirror src/lib/types.ts)
export const LessonCardsSchema = z.object({
  lessonTitle: z.string(),
  cards: z
    .array(
      z.union([
        z.object({
          type: z.literal("text"),
          title: z.string().nullable().optional(),
          body: z.string().min(1),
        }),
        z.object({
          type: z.literal("quiz"),
          title: z.string().nullable().optional(),
          question: z.string(),
          options: z.array(z.string()).min(2),
          answerIndex: z.number().int().min(0),
          explanation: z.string().nullable().optional(),
        }),
        z.object({
          type: z.literal("fill-blank"),
          title: z.string().nullable().optional(),
          text: z.string(),
          answers: z.record(z.string(), z.string()),
          caseSensitive: z.boolean().optional(),
        }),
      ])
    )
    .min(3)
    .max(20),
});

export type LessonCardsOutput = z.infer<typeof LessonCardsSchema>;

// JSON Schemas for OpenAI Structured Outputs (function calling)
export const CoursePlanJSONSchema = {
  title: "CoursePlan",
  type: "object",
  properties: {
    course: {
      type: "object",
      properties: {
        title: { type: "string", minLength: 1 },
        description: { type: ["string", "null"] },
        category: { type: ["string", "null"] },
      },
      // Responses API の制約: properties に含めたキーを required に全列挙
      required: ["title", "description", "category"],
      additionalProperties: false,
    },
    lessons: {
      type: "array",
      minItems: 3,
      maxItems: 30,
      items: {
        type: "object",
        properties: {
          title: { type: "string", minLength: 1 },
          summary: { type: ["string", "null"] },
        },
        // 全列挙 required（未使用は null を許容）
        required: ["title", "summary"],
        additionalProperties: false,
      },
    },
  },
  required: ["course", "lessons"],
  additionalProperties: false,
} as const;

export const LessonCardsJSONSchema = {
  title: "LessonCards",
  type: "object",
  properties: {
    lessonTitle: { type: "string" },
    cards: {
      type: "array",
      minItems: 3,
      maxItems: 20,
      items: {
        type: "object",
        properties: {
          // discriminator
          type: { type: "string", enum: ["text", "quiz", "fill-blank"] },
          title: { type: ["string", "null"] },

          // text
          body: { type: ["string", "null"] },

          // quiz
          question: { type: ["string", "null"] },
          options: { type: ["array", "null"], items: { type: "string" }, minItems: 2 },
          answerIndex: { type: ["integer", "null"], minimum: 0 },
          explanation: { type: ["string", "null"] },

          // fill-blank
          text: { type: ["string", "null"] },
          answers: {
            // patternProperties は使わず、任意キーの文字列値を許容
            type: ["object", "null"],
            additionalProperties: { type: "string" },
          },
          caseSensitive: { type: ["boolean", "null"] },
        },
        // Responses API の制約: properties に含めたキーを required に全列挙
        required: [
          "type",
          "title",
          "body",
          "question",
          "options",
          "answerIndex",
          "explanation",
          "text",
          "answers",
          "caseSensitive",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["lessonTitle", "cards"],
  additionalProperties: false,
} as const;
