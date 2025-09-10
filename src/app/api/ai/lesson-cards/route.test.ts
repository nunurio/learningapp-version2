/* @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("api/ai/lesson-cards POST", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("desiredCount > 1 の一括生成は 400 を返す", async () => {
    const { POST } = await import("./route");
    const res = await POST(new Request("http://local/api/ai/lesson-cards", { method: "POST", body: JSON.stringify({ desiredCount: 3 }), headers: { "Content-Type": "application/json" } }));
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toMatch(/Batch generation is no longer supported/);
  });

  it("単体生成で SingleCardAgent が呼ばれる", async () => {
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
