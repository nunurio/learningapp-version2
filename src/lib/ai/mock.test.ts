import { describe, it, expect } from "vitest";
import { generateCoursePlan, generateLessonCards } from "@/lib/ai/mock";

describe("generateCoursePlan", () => {
  it("lessonCountの下限/上限を満たす", () => {
    expect(generateCoursePlan({ theme: "JS", lessonCount: 1 }).lessons).toHaveLength(3);
    expect(generateCoursePlan({ theme: "JS", lessonCount: 99 }).lessons).toHaveLength(30);
  });

  it("タイトル構成が期待どおり", () => {
    const p = generateCoursePlan({ theme: "Python", level: "初級" });
    expect(p.course.title.startsWith("Python 入門（初級）")).toBe(true);
  });
});

describe("generateLessonCards", () => {
  it("desiredCountの下限/上限を満たす", () => {
    expect(generateLessonCards({ lessonTitle: "L", desiredCount: 1 }).cards).toHaveLength(3);
    expect(generateLessonCards({ lessonTitle: "L", desiredCount: 99 }).cards).toHaveLength(20);
  });

  it("3種(type)が循環で並ぶ", () => {
    const { cards } = generateLessonCards({ lessonTitle: "L", desiredCount: 6 });
    expect(cards.map((c) => c.type)).toEqual([
      "text",
      "quiz",
      "fill-blank",
      "text",
      "quiz",
      "fill-blank",
    ]);
  });
});
