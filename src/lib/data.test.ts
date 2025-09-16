import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/client-api", () => ({
  updateCard: vi.fn(async () => {}),
}));

import { saveCard, type CardSaveInput } from "@/lib/data";
import { updateCard } from "@/lib/client-api";

describe("lib/data saveCard", () => {
  it("sends text card patch and returns timestamp", async () => {
    const now = new Date("2025-09-16T10:11:12.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const payload: CardSaveInput = { cardId: "CID", cardType: "text", body: "markdown", title: "T", tags: ["tag"] };
    const res = await saveCard(payload);
    expect(res.updatedAt).toBe(now.toISOString());
    expect(updateCard).toHaveBeenCalledWith("CID", { title: "T", tags: ["tag"], content: { body: "markdown" } });
  });

  it("sends quiz card patch", async () => {
    const payload: CardSaveInput = {
      cardId: "CID2",
      cardType: "quiz",
      title: null,
      tags: undefined,
      question: "Q",
      options: ["a", "b"],
      answerIndex: 1,
      explanation: "exp",
      optionExplanations: ["ea", "eb"],
      hint: "hint",
    };
    await saveCard(payload);
    expect(updateCard).toHaveBeenCalledWith("CID2", {
      title: null,
      tags: undefined,
      content: {
        question: "Q",
        options: ["a", "b"],
        answerIndex: 1,
        explanation: "exp",
        optionExplanations: ["ea", "eb"],
        hint: "hint",
      },
    });
  });

  it("sends fill-blank card patch with defaults", async () => {
    const payload: CardSaveInput = {
      cardId: "CID3",
      cardType: "fill-blank",
      title: undefined,
      tags: [],
      text: "[[1]]",
      answers: { "1": "A" },
      caseSensitive: undefined,
    };
    await saveCard(payload);
    expect(updateCard).toHaveBeenCalledWith("CID3", {
      title: null,
      tags: [],
      content: {
        text: "[[1]]",
        answers: { "1": "A" },
        caseSensitive: false,
      },
    });
  });
});
