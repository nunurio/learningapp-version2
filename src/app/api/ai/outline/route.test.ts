/* @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("api/ai/outline POST", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("テーマ未指定時は 'コース' を使い JSON を返す", async () => {
    const run = vi.fn(async () => ({ course: { title: "A" }, lessons: [] }));
    vi.doMock("@/lib/ai/agents/outline", () => ({ runOutlineAgent: run }));

    const { POST } = await import("./route");
    const res = await POST(new Request("http://local/api/ai/outline", { method: "POST" }));
    expect(res.headers.get("cache-control")).toContain("no-store");
    const json = (await res.json()) as unknown as { plan: unknown };
    expect(json.plan).toBeTruthy();
    expect(run).toHaveBeenCalledWith({ theme: "コース", level: undefined, goal: undefined, lessonCount: undefined });
  });

  it("生成で例外発生時は 500 を返す", async () => {
    const run = vi.fn(async () => { throw new Error("boom"); });
    vi.doMock("@/lib/ai/agents/outline", () => ({ runOutlineAgent: run }));
    const { POST } = await import("./route");
    const res = await POST(new Request("http://local/api/ai/outline", { method: "POST" }));
    expect(res.status).toBe(500);
    const json = (await res.json()) as unknown as { error: string };
    expect(json.error).toContain("boom");
  });
});
