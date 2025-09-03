/* @vitest-environment node */
import { describe, it, expect, vi } from "vitest";

describe("api/ai/lesson-cards POST", () => {
  it("lessonTitle 未指定時は 'レッスン' を使い JSON を返す", async () => {
    const gen = vi.fn(() => ({ lessonTitle: "X", cards: [] }));
    vi.doMock("@/lib/ai/mock", () => ({ generateLessonCards: gen }));

    const { POST } = await import("./route");
    const res = await POST(new Request("http://local/api/ai/lesson-cards", { method: "POST" } as any) as any);
    expect(res.headers.get("cache-control")).toContain("no-store");
    const json = (await res.json()) as any;
    expect(json.payload).toBeTruthy();
    expect(gen).toHaveBeenCalledWith({ lessonTitle: "レッスン", desiredCount: undefined });
  });
});

