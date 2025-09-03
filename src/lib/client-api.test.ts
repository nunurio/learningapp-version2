import { describe, it, expect, vi } from "vitest";

vi.mock("@/server-actions/courses", () => ({
  createCourseAction: vi.fn(async () => ({ courseId: "00000000-0000-0000-0000-000000000001" })),
}));

import { listCourses } from "@/lib/client-api";

describe("client-api", () => {
  it("reads: listCourses は /api/db を叩いて配列を返す", async () => {
    const data = await listCourses();
    expect(Array.isArray(data)).toBe(true);
    // tests/msw.ts の既定ハンドラが 1 件返す
    expect(data[0]).toMatchObject({ id: "c1", title: "Course" });
  });

  it("reads: 非JSONレスポンス時は分かりやすいエラーを投げる", async () => {
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("<html>redirect</html>", { headers: { "content-type": "text/html" } }));
    await expect(listCourses()).rejects.toThrow(/Unexpected non-JSON response/);
    spy.mockRestore();
  });

  it("writes: createCourse は Server Action に委譲する", async () => {
    const { createCourse: impl } = await import("@/lib/client-api");
    const res = await impl({ title: "T" });
    const mod = await import("@/server-actions/courses");
    expect(vi.mocked(mod.createCourseAction)).toHaveBeenCalledWith({ title: "T" });
    expect(res.courseId).toMatch(/^0000/);
  });
});
