import { describe, it, expect, vi, afterEach } from "vitest";
import type { UUID } from "@/lib/types";

function mockFetchOnce(payload: unknown, init: Partial<ResponseInit> = {}) {
  const json = JSON.stringify(payload);
  const res = new Response(json, {
    status: init.status ?? 200,
    headers: { "content-type": "application/json" },
  });
  const spy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(res);
  return spy;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("client-api reads", () => {
  it("getCourse: null→undefined 正規化し、リクエストにUUIDが含まれる", async () => {
    // Arrange
    const bodySpy = vi.spyOn(globalThis, "fetch").mockImplementationOnce(async (_url, init?: RequestInit) => {
      const bodyStr = init?.body as string;
      const b = JSON.parse(bodyStr) as { op: string; params: { courseId: UUID } };
      expect(b.op).toBe("getCourse");
      expect(b.params.courseId).toBe("00000000-0000-0000-0000-000000000001");
      return new Response("null", { status: 200, headers: { "content-type": "application/json" } });
    });
    const { getCourse } = await import("@/lib/client-api");
    const out = await getCourse("00000000-0000-0000-0000-000000000001" as UUID);
    expect(out).toBeUndefined();
    bodySpy.mockRestore();
  });

  it("listLessons/listCards は配列を返す", async () => {
    mockFetchOnce([{ id: "l1" }]);
    const { listLessons } = await import("@/lib/client-api");
    const ls = await listLessons("00000000-0000-0000-0000-000000000001" as UUID);
    expect(Array.isArray(ls)).toBe(true);
    mockFetchOnce([{ id: "k1" }]);
    const { listCards } = await import("@/lib/client-api");
    const cs = await listCards("00000000-0000-0000-0000-000000000002" as UUID);
    expect(Array.isArray(cs)).toBe(true);
  });

  it("getProgress: null→undefined 正規化", async () => {
    mockFetchOnce(null);
    const { getProgress } = await import("@/lib/client-api");
    const p = await getProgress("00000000-0000-0000-0000-000000000003" as UUID);
    expect(p).toBeUndefined();
  });

  it("listFlaggedByCourse/getNote: 値を返す/undefined 正規化", async () => {
    mockFetchOnce(["c1", "c2"]);
    const { listFlaggedByCourse, getNote } = await import("@/lib/client-api");
    const ids = await listFlaggedByCourse("00000000-0000-0000-0000-000000000001" as UUID);
    expect(ids.length).toBe(2);
    mockFetchOnce(null);
    const note = await getNote("00000000-0000-0000-0000-000000000001" as UUID);
    expect(note).toBeUndefined();
  });

  it("/api/db が 500 を返すと本文を含むエラーを throw", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("boom", { status: 500, headers: { "content-type": "text/plain" } })
    );
    const { listCourses } = await import("@/lib/client-api");
    await expect(listCourses()).rejects.toThrow(/boom/);
    spy.mockRestore();
  });
});
