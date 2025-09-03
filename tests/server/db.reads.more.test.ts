/* @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from "vitest";

function makeThenable(data: any, error: any) {
  return { then: (resolve: any) => resolve({ data, error }) } as any;
}

function supaForListCoursesNull() {
  return {
    from: (table: string) => ({
      select: () => ({
        order: () => makeThenable(null, null),
      }),
    }),
  } as any;
}

function supaForMaybeSingle(data: any, error: any = null) {
  return {
    from: (_t: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => ({ data, error }),
        }),
      }),
    }),
  } as any;
}

function supaForList(table: string, rows: any[] | null, error: any = null) {
  return {
    from: (t: string) => ({
      select: () => ({
        eq: () => ({ order: () => ({ order: () => makeThenable(t === table ? rows : null, t === table ? error : null) }) }),
      }),
    }),
  } as any;
}

beforeEach(() => {
  vi.resetModules();
});

describe("db/queries reads (extra)", () => {
  it("listCourses: null -> []", async () => {
    vi.doMock("@/lib/supabase/server", () => ({ createClient: async () => supaForListCoursesNull() }));
    const { listCourses } = await import("@/lib/db/queries");
    const rows = await listCourses();
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBe(0);
  });

  it("getCourse: maybeSingle null -> undefined", async () => {
    vi.doMock("@/lib/supabase/server", () => ({ createClient: async () => supaForMaybeSingle(null) }));
    const { getCourse } = await import("@/lib/db/queries");
    const row = await getCourse("00000000-0000-0000-0000-000000000001" as any);
    expect(row).toBeUndefined();
  });

  it("listLessons/listCards: null -> [] and error passthrough", async () => {
    // null -> [] for lessons
    vi.doMock("@/lib/supabase/server", () => ({ createClient: async () => supaForList("lessons", null) }));
    let mod = await import("@/lib/db/queries");
    const l = await mod.listLessons("c1" as any);
    expect(l).toEqual([]);

    // null -> [] for cards
    vi.resetModules();
    vi.doMock("@/lib/supabase/server", () => ({ createClient: async () => supaForList("cards", null) }));
    mod = await import("@/lib/db/queries");
    const c = await mod.listCards("l1" as any);
    expect(c).toEqual([]);

    // error passthrough for lessons
    const pgErr = Object.assign(new Error("boom"), { name: "PostgrestError", code: "XX000" });
    vi.resetModules();
    vi.doMock("@/lib/supabase/server", () => ({ createClient: async () => supaForList("lessons", null, pgErr) }));
    mod = await import("@/lib/db/queries");
    await expect(mod.listLessons("c1" as any)).rejects.toBe(pgErr);
  });
});

