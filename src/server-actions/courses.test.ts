/* @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from "vitest";

function mockSupaForCourses() {
  const supa: any = {};
  supa.from = vi.fn((table: string) => {
    if (table !== "courses") throw new Error("unexpected table: " + table);
    const q: any = {
      insert: vi.fn(() => q),
      update: vi.fn(() => q),
      delete: vi.fn(() => q),
      eq: vi.fn(() => q),
      select: vi.fn(() => q),
      single: vi.fn(() => ({ data: { id: "COURSE_ID" }, error: null })),
    };
    return q;
  });
  return supa;
}

describe("server-actions/courses", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("createCourseAction: insert → revalidatePath('/') を呼ぶ", async () => {
    const supa = mockSupaForCourses();
    const reval = vi.fn();
    vi.doMock("next/cache", () => ({ revalidatePath: reval }));
    vi.doMock("@/lib/supabase/server", () => ({
      createClient: async () => supa,
      getCurrentUserId: async () => "uid",
    }));
    const { createCourseAction } = await import("./courses");
    const res = await createCourseAction({ title: " T " });
    expect(res.courseId).toBe("COURSE_ID");
    expect(reval).toHaveBeenCalledWith("/");
  });

  it("updateCourseAction: update → '/' と workspace を revalidate", async () => {
    const supa: any = {
      from: vi.fn((table: string) => {
        if (table !== "courses") throw new Error("unexpected table: " + table);
        const q: any = {
          update: vi.fn(() => q),
          eq: vi.fn(() => ({ error: null })),
        };
        return q;
      }),
    };
    const reval = vi.fn();
    vi.doMock("next/cache", () => ({ revalidatePath: reval }));
    vi.doMock("@/lib/supabase/server", () => ({ createClient: async () => supa }));
    const { updateCourseAction } = await import("./courses");
    await updateCourseAction("CID" as any, { title: "X" });
    expect(reval).toHaveBeenCalledWith("/");
    expect(reval).toHaveBeenCalledWith(`/courses/CID/workspace`, "page");
  });

  it("deleteCourseAction: delete → '/' と workspace を revalidate", async () => {
    const supa: any = {
      from: vi.fn((table: string) => {
        if (table !== "courses") throw new Error("unexpected table: " + table);
        const q: any = {
          delete: vi.fn(() => q),
          eq: vi.fn(() => ({ error: null })),
        };
        return q;
      }),
    };
    const reval = vi.fn();
    vi.doMock("next/cache", () => ({ revalidatePath: reval }));
    vi.doMock("@/lib/supabase/server", () => ({ createClient: async () => supa }));
    const { deleteCourseAction } = await import("./courses");
    await deleteCourseAction("COURSE_ID" as any);
    expect(reval).toHaveBeenCalledWith("/");
    expect(reval).toHaveBeenCalledWith(`/courses/COURSE_ID/workspace`, "page");
  });

  it("deleteCourseAction: エラー時は throw し revalidate を呼ばない", async () => {
    const supa: any = {
      from: vi.fn((table: string) => {
        if (table !== "courses") throw new Error("unexpected table: " + table);
        const q: any = {
          delete: vi.fn(() => q),
          eq: vi.fn(() => ({ error: Object.assign(new Error("boom"), { code: "23503" }) })),
        };
        return q;
      }),
    };
    const reval = vi.fn();
    vi.doMock("next/cache", () => ({ revalidatePath: reval }));
    vi.doMock("@/lib/supabase/server", () => ({ createClient: async () => supa }));
    const { deleteCourseAction } = await import("./courses");
    await expect(deleteCourseAction("COURSE_ID" as any)).rejects.toBeInstanceOf(Error);
    expect(reval).not.toHaveBeenCalled();
  });
});
