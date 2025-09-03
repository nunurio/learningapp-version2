/* @vitest-environment node */
import { describe, it, expect, vi } from "vitest";

describe("api/ai/outline POST", () => {
  it("テーマ未指定時は 'コース' を使い JSON を返す", async () => {
    const gen = vi.fn(() => ({ course: { title: "A" }, lessons: [] }));
    vi.doMock("@/lib/ai/mock", () => ({ generateCoursePlan: gen }));

    const { POST } = await import("./route");
    const res = await POST(new Request("http://local/api/ai/outline", { method: "POST" } as any) as any);
    expect(res.headers.get("cache-control")).toContain("no-store");
    const json = (await res.json()) as any;
    expect(json.plan).toBeTruthy();
    expect(gen).toHaveBeenCalledWith({ theme: "コース", level: undefined, goal: undefined, lessonCount: undefined });
  });
});

