import { describe, it, expect } from "vitest";
import { LessonCardsSchema } from "@/lib/ai/schema";

describe("LessonCardsSchema", () => {
  it("rejects quiz cards without hint", () => {
    expect(() =>
      LessonCardsSchema.parse({
        lessonTitle: "Test",
        cards: [
          {
            type: "quiz",
            title: null,
            body: null,
            question: "Q?",
            options: ["A", "B"],
            answerIndex: 0,
            explanation: "理由",
            optionExplanations: ["良い理由", "悪い理由"],
            hint: null,
            text: null,
            answers: null,
            caseSensitive: null,
          },
        ],
      })
    ).toThrowError(/hint is required/);
  });

  it("accepts quiz cards with non-empty hint", () => {
    const result = LessonCardsSchema.parse({
      lessonTitle: "Test",
      cards: [
        {
          type: "quiz",
          title: null,
          body: null,
          question: "Q?",
          options: ["A", "B"],
          answerIndex: 0,
          explanation: "理由",
          optionExplanations: ["良い理由", "悪い理由"],
          hint: "ヒント",
          text: null,
          answers: null,
          caseSensitive: null,
        },
        {
          type: "text",
          title: null,
          body: "Body",
          question: null,
          options: null,
          answerIndex: null,
          explanation: null,
          optionExplanations: null,
          hint: null,
          text: null,
          answers: null,
          caseSensitive: null,
        },
        {
          type: "text",
          title: null,
          body: "Body2",
          question: null,
          options: null,
          answerIndex: null,
          explanation: null,
          optionExplanations: null,
          hint: null,
          text: null,
          answers: null,
          caseSensitive: null,
        },
      ],
    });
    expect(result.cards[0]?.hint).toBe("ヒント");
  });
});
