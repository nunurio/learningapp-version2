/* @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("api/ai/lesson-cards POST", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("lessonTitle 未指定時は 'レッスン' を使い JSON を返す (batch path)", async () => {
    const run = vi.fn(async () => ({ payload: { items: [] }, updates: [] }));
    vi.doMock("@/lib/ai/agents/lesson-cards", () => ({ runLessonCardsAgent: run }));

    const { POST } = await import("./route");
    // Force batch path by specifying desiredCount >= 3
    const res = await POST(new Request("http://local/api/ai/lesson-cards", { method: "POST", body: JSON.stringify({ desiredCount: 3 }), headers: { "Content-Type": "application/json" } }));
    expect(res.headers.get("cache-control")).toContain("no-store");
    const json = (await res.json()) as unknown as { payload: unknown };
    expect(json.payload).toBeTruthy();
    expect(run).toHaveBeenCalledWith({ lessonTitle: "レッスン", desiredCount: 3, course: undefined });
  });

  it("生成で例外発生時は 500 を返す (batch path)", async () => {
    const run = vi.fn(async () => { throw new Error("fail"); });
    vi.doMock("@/lib/ai/agents/lesson-cards", () => ({ runLessonCardsAgent: run }));
    const { POST } = await import("./route");
    const res = await POST(new Request("http://local/api/ai/lesson-cards", { method: "POST", body: JSON.stringify({ desiredCount: 3 }), headers: { "Content-Type": "application/json" } }));
    expect(res.status).toBe(500);
    const json = (await res.json()) as unknown as { error: string };
    expect(json.error).toContain("fail");
  });

  it("単体生成の分岐で SingleCardAgent が呼ばれる", async () => {
    const single = vi.fn(async () => ({ lessonTitle: "X", cards: [{ type: "text", title: null, body: "b", question: null, options: null, answerIndex: null, explanation: null, text: null, answers: null, caseSensitive: null }] }));
    vi.doMock("@/lib/ai/agents/lesson-cards", () => ({ runSingleCardAgent: single }));
    const { POST } = await import("./route");
    const res = await POST(new Request("http://local/api/ai/lesson-cards", { method: "POST", body: JSON.stringify({ desiredCount: 1, lessonTitle: "L", desiredCardType: "text", userBrief: "概要" }), headers: { "Content-Type": "application/json" } }));
    expect(res.ok).toBe(true);
    const json = (await res.json()) as { payload: unknown };
    expect(json.payload).toBeTruthy();
    expect(single).toHaveBeenCalledWith({ lessonTitle: "L", course: undefined, desiredCardType: "text", userBrief: "概要" });
  });
});
