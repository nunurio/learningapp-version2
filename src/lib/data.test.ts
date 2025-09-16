import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/idb", () => ({
  draftsPut: vi.fn(async () => {}),
  draftsGet: vi.fn(async (_key: string) => undefined),
  draftsDelete: vi.fn(async () => {}),
}));

vi.mock("@/lib/client-api", () => ({
  updateCard: vi.fn(async () => {}),
}));

import { saveCardDraft, loadCardDraft, publishCard, type SaveCardDraftInput } from "@/lib/data";
import type { DraftRow } from "@/lib/idb";
import { draftsPut, draftsGet, draftsDelete } from "@/lib/idb";
import { updateCard } from "@/lib/client-api";

describe("lib/data (draft + publish)", () => {
  it("saveCardDraft stores a normalized row with key and timestamps", async () => {
    const now = new Date("2025-09-03T12:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const res = await saveCardDraft({ cardId: "CID", cardType: "text", body: "hello" });
    expect(res.updatedAt).toBe(now.toISOString());
    expect(draftsPut).toHaveBeenCalledTimes(1);
    const row = vi.mocked(draftsPut).mock.calls[0][0] as unknown as DraftRow;
    expect(row).toMatchObject({ key: "card:CID", cardId: "CID", cardType: "text", title: null, updatedAt: now.toISOString() });
  });

  it("loadCardDraft returns the saved data or undefined", async () => {
    vi.mocked(draftsGet).mockResolvedValueOnce({ key: "card:CID", data: { ok: true } } as unknown as DraftRow);
    const got = await loadCardDraft("CID");
    expect(got).toEqual({ ok: true });
    vi.mocked(draftsGet).mockResolvedValueOnce(undefined);
    const none = await loadCardDraft("NONE");
    expect(none).toBeUndefined();
  });

  it("publishCard applies branch by cardType and deletes draft (text/quiz/fill-blank)", async () => {
    // text branch
    vi.mocked(draftsGet).mockResolvedValueOnce({ data: { cardId: "C1", cardType: "text", body: "b", title: "T" } as SaveCardDraftInput } as unknown as DraftRow);
    await publishCard("C1");
    expect(updateCard).toHaveBeenCalledWith("C1", { title: "T", tags: undefined, content: { body: "b" } });

    // quiz branch
    vi.mocked(draftsGet).mockResolvedValueOnce({ data: { cardId: "C2", cardType: "quiz", title: null, question: "q", options: ["a","b"], answerIndex: 1, explanation: undefined, optionExplanations: ["ok", "ng"], hint: "ヒント" } as SaveCardDraftInput } as unknown as DraftRow);
    await publishCard("C2");
    expect(updateCard).toHaveBeenCalledWith("C2", { title: null, tags: undefined, content: { question: "q", options: ["a","b"], answerIndex: 1, explanation: undefined, optionExplanations: ["ok", "ng"], hint: "ヒント" } });

    // fill-blank branch
    vi.mocked(draftsGet).mockResolvedValueOnce({ data: { cardId: "C3", cardType: "fill-blank", title: undefined, text: "t", answers: { a: "1" }, caseSensitive: true } as SaveCardDraftInput } as unknown as DraftRow);
    await publishCard("C3");
    expect(updateCard).toHaveBeenCalledWith("C3", { title: null, tags: undefined, content: { text: "t", answers: { a: "1" }, caseSensitive: true } });

    // finally, draftsDelete called for each publish
    expect(draftsDelete).toHaveBeenCalledTimes(3);
  });
});
