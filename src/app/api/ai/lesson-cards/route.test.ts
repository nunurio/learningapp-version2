/* @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("api/ai/lesson-cards POST", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("lessonTitle 未指定時は 'レッスン' を使い JSON を返す", async () => {
    const run = vi.fn(async () => ({ payload: { items: [] }, updates: [] }));
    vi.doMock("@/lib/ai/langgraph/lesson-cards", () => ({ runLessonCardsGraph: run }));

    const { POST } = await import("./route");
    const res = await POST(new Request("http://local/api/ai/lesson-cards", { method: "POST" }));
    expect(res.headers.get("cache-control")).toContain("no-store");
    const json = (await res.json()) as unknown as { payload: unknown };
    expect(json.payload).toBeTruthy();
    expect(run).toHaveBeenCalledWith({ lessonTitle: "レッスン", desiredCount: undefined, course: undefined });
  });

  it("生成で例外発生時は 500 を返す", async () => {
    const run = vi.fn(async () => { throw new Error("fail"); });
    vi.doMock("@/lib/ai/langgraph/lesson-cards", () => ({ runLessonCardsGraph: run }));
    const { POST } = await import("./route");
    const res = await POST(new Request("http://local/api/ai/lesson-cards", { method: "POST" }));
    expect(res.status).toBe(500);
    const json = (await res.json()) as unknown as { error: string };
    expect(json.error).toContain("fail");
  });
});
