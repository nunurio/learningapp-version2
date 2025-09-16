import { z } from "zod";

// CoursePlan schema (must mirror src/lib/types.ts)
export const CoursePlanSchema = z.object({
  course: z.object({
    title: z.string().min(1),
    // Structured Outputs要件: 省略不可 -> null許容にする
    description: z.string().nullable(),
    category: z.string().nullable(),
    level: z.string().nullable(),
  }),
  lessons: z
    .array(
      z.object({
        title: z.string().min(1),
        // 省略不可 -> null許容
        summary: z.string().nullable(),
      })
    )
    .min(3)
    .max(30),
});

export type CoursePlanOutput = z.infer<typeof CoursePlanSchema>;

// LessonCards schema (must mirror src/lib/types.ts)
// Structured Outputsの制約に合わせ、全フィールドをrequiredにしつつ未使用はnullで表現
export const LessonCardItemSchema = z
  .object({
    // discriminator
    type: z.enum(["text", "quiz", "fill-blank"]),
    title: z.string().nullable(),

    // text
    body: z.string().nullable(),

    // quiz
    question: z.string().nullable(),
    options: z.array(z.string()).nullable(),
    answerIndex: z.number().int().min(0).nullable(),
    explanation: z.string().nullable(),
    optionExplanations: z.array(z.string().nullable()).nullable(),
    hint: z.string().nullable(),

    // fill-blank
    text: z.string().nullable(),
    answers: z.record(z.string(), z.string()).nullable(),
    caseSensitive: z.boolean().nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.type === "text") {
      if (v.body == null || v.body.trim().length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["body"], message: "body is required for text" });
      }
    } else if (v.type === "quiz") {
      if (v.question == null || v.question.trim().length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["question"], message: "question is required for quiz" });
      }
      if (!Array.isArray(v.options) || v.options.length < 2) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["options"], message: "options must have at least 2 items" });
      }
      if (v.answerIndex == null || v.answerIndex < 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["answerIndex"], message: "answerIndex is required for quiz" });
      }
      if (v.optionExplanations != null) {
        if (!Array.isArray(v.optionExplanations)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["optionExplanations"], message: "optionExplanations must be an array" });
        } else {
          if (Array.isArray(v.options) && v.optionExplanations.length !== v.options.length) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["optionExplanations"], message: "optionExplanations length must match options" });
          }
          v.optionExplanations.forEach((text, idx) => {
            if (typeof text !== "string" || text.trim().length === 0) {
              ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["optionExplanations", idx], message: "option explanations must be non-empty strings" });
            }
          });
        }
      }
      if (typeof v.hint !== "string" || v.hint.trim().length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["hint"], message: "hint is required and must be non-empty" });
      }
    } else if (v.type === "fill-blank") {
      if (v.text == null || v.text.trim().length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["text"], message: "text is required for fill-blank" });
      }
      if (v.answers == null || typeof v.answers !== "object") {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["answers"], message: "answers is required for fill-blank" });
      }
    }
  });

export const LessonCardsSchema = z.object({
  lessonTitle: z.string(),
  cards: z.array(LessonCardItemSchema).min(3).max(20),
});

// 単体カード（1件）専用スキーマ
export const SingleLessonCardsSchema = z.object({
  lessonTitle: z.string(),
  cards: z.array(LessonCardItemSchema).min(1).max(1),
});

export type LessonCardsOutput = z.infer<typeof LessonCardsSchema>;

// --- Planning phase -------------------------------------------------------
// レッスン一式を作る前に、カードの枚数・順番・タイプ・概要を決める計画スキーマ
export const CardPlanItemSchema = z
  .object({
    // text | quiz | fill-blank
    type: z.enum(["text", "quiz", "fill-blank"]),
    // そのカードのねらい（概要）。詳細はここでは禁止。
    // 例: 「導入：課題意識を醸成」「要点整理：主要用語の関係を俯瞰」
    brief: z.string().min(1).max(140),
    // 任意タイトル（なくても良い）
    title: z.string().nullable().optional(),
  })
  .superRefine((v, ctx) => {
    // 企画段階の brief に含めてはならない具体要素を簡易チェック
    const s = v.brief ?? "";
    if (/選択肢|正解|\[\[(\d+)\]\]/.test(s)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["brief"],
        message: "brief は概要のみ。『選択肢』『正解』や [[n]] の空所指定は含めないでください",
      });
    }
    if (/[A-E]\)/.test(s)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["brief"],
        message: "brief に A) などの列挙記法は含めないでください",
      });
    }
  });

export const LessonCardsPlanSchema = z.object({
  lessonTitle: z.string(),
  // 最終的に生成する枚数（cards.length と一致する）
  count: z.number().int().min(3).max(20),
  // 生成順に並べた計画
  cards: z.array(CardPlanItemSchema).min(3).max(20),
  // 後続の単体生成で共通に再利用するプレフィックス（Prompt Caching用）
  sharedPrefix: z.string().nullable().optional(),
});
export type LessonCardsPlan = z.infer<typeof LessonCardsPlanSchema>;

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
        level: { type: ["string", "null"] },
      },
      // Responses API の制約: properties に含めたキーを required に全列挙
      required: ["title", "description", "category", "level"],
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
          optionExplanations: { type: ["array", "null"], items: { type: ["string", "null"] } },
          hint: { type: ["string", "null"] },

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
          "optionExplanations",
          "hint",
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
