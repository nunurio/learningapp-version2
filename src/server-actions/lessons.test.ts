/* @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("server-actions/lessons", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("addLessonAction: 既存最大 order_index+1 を採番して挿入し、workspace を再検証", async () => {
    const calls: any[] = [];
    const supa: any = {
      from: vi.fn((table: string) => {
        if (table === "lessons") {
          const q: any = {};
          q.select = vi.fn(() => q);
          q.eq = vi.fn(() => q);
          q.order = vi.fn(() => q);
          q.limit = vi.fn(async () => ({ data: [{ order_index: 2 }], error: null }));
          q.insert = vi.fn((payload: any) => {
            calls.push({ op: "insert", payload });
            return {
              select: () => ({ single: async () => ({ data: { id: "LNEW" }, error: null }) }),
            };
          });
          return q;
        }
        throw new Error("unexpected table: " + table);
      }),
    };
    const reval = vi.fn();
    vi.doMock("next/cache", () => ({ revalidatePath: reval }));
    vi.doMock("@/lib/supabase/server", () => ({ createClient: async () => supa }));

    const { addLessonAction } = await import("./lessons");
    const out = await addLessonAction("COURSE_X" as any, " Title ");
    expect(out.lessonId).toBe("LNEW");
    expect(calls[0].payload).toMatchObject({ course_id: "COURSE_X", title: "Title", order_index: 3 });
    expect(reval).toHaveBeenCalledWith(`/courses/COURSE_X/workspace`, "page");
  });

  it("deleteLessonAction: 関連 course を取得して削除後に再検証", async () => {
    const supa: any = {
      from: vi.fn((table: string) => {
        if (table !== "lessons") throw new Error("unexpected table: " + table);
        const q: any = {};
        q.select = vi.fn(() => q);
        q.eq = vi.fn(() => q);
        q.single = vi.fn(async () => ({ data: { course_id: "COURSE_A" }, error: null }));
        q.delete = vi.fn(() => ({ eq: async () => ({ error: null }) }));
        return q;
      }),
    };
    const reval = vi.fn();
    vi.doMock("next/cache", () => ({ revalidatePath: reval }));
    vi.doMock("@/lib/supabase/server", () => ({ createClient: async () => supa }));
    const { deleteLessonAction } = await import("./lessons");
    await deleteLessonAction("LESSON_1" as any);
    expect(reval).toHaveBeenCalledWith(`/courses/COURSE_A/workspace`, "page");
  });

  it("reorderLessonsAction: 集合不一致ならエラー", async () => {
    const supa: any = {
      from: vi.fn((table: string) => {
        if (table !== "lessons") throw new Error("unexpected table: " + table);
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({ data: [{ id: "L1", order_index: 0 }], error: null }),
            }),
          }),
        };
      }),
    };
    const reval = vi.fn();
    vi.doMock("next/cache", () => ({ revalidatePath: reval }));
    vi.doMock("@/lib/supabase/server", () => ({ createClient: async () => supa }));
    const { reorderLessonsAction } = await import("./lessons");
    await expect(reorderLessonsAction("C1" as any, ["L1", "L2"] as any)).rejects.toBeInstanceOf(Error);
    expect(reval).not.toHaveBeenCalled();
  });

  it("reorderLessonsAction: 正常系は2段階更新して再検証", async () => {
    const updates: any[] = [];
    const supa: any = {
      from: vi.fn((table: string) => {
        if (table !== "lessons") throw new Error("unexpected table: " + table);
        const qsel = {
          select: () => ({
            eq: () => ({ order: async () => ({ data: [
              { id: "L1", order_index: 0 },
              { id: "L2", order_index: 1 },
              { id: "L3", order_index: 2 },
            ], error: null }) }),
          }),
        };
        const qupd = {
          update: (payload: any) => ({
            eq: (_k: string, _v: string) => ({
              eq: async () => {
                updates.push(payload);
                return { error: null };
              },
            }),
          }),
        };
        return { ...qsel, ...qupd };
      }),
    };
    const reval = vi.fn();
    vi.doMock("next/cache", () => ({ revalidatePath: reval }));
    vi.doMock("@/lib/supabase/server", () => ({ createClient: async () => supa }));
    const { reorderLessonsAction } = await import("./lessons");
    await reorderLessonsAction("COURSE_Z" as any, ["L3", "L2", "L1"] as any);
    // Phase1: 3件、Phase2: 3件 で計6回 order_index を更新
    expect(updates.length).toBe(6);
    // 最終的に 0,1,2 が含まれる
    expect(updates.some((u) => u.order_index === 0)).toBe(true);
    expect(updates.some((u) => u.order_index === 1)).toBe(true);
    expect(updates.some((u) => u.order_index === 2)).toBe(true);
    expect(reval).toHaveBeenCalledWith(`/courses/COURSE_Z/workspace`, "page");
  });

  it("reorderLessonsAction: 途中失敗でロールバックを試み、最終的に throw", async () => {
    const updates: any[] = [];
    let failOnce = true;
    const supa: any = {
      from: vi.fn((table: string) => {
        if (table !== "lessons") throw new Error("unexpected table: " + table);
        const qsel = {
          select: () => ({
            eq: () => ({ order: async () => ({ data: [
              { id: "L1", order_index: 0 },
              { id: "L2", order_index: 1 },
            ], error: null }) }),
          }),
        };
        const qupd = {
          update: (payload: any) => ({
            eq: (_k: string, v: string) => ({
              eq: async () => {
                // Phase1中にL2でエラーを発生させる（provisionalは1000000以上）
                if (failOnce && typeof payload.order_index === "number" && payload.order_index >= 1_000_000 && v === "L2") {
                  failOnce = false;
                  return { error: Object.assign(new Error("phase1 fail"), { code: "23505" }) };
                }
                updates.push({ id: v, oi: payload.order_index });
                return { error: null };
              },
            }),
          }),
        };
        return { ...qsel, ...qupd };
      }),
    };
    const reval = vi.fn();
    vi.doMock("next/cache", () => ({ revalidatePath: reval }));
    vi.doMock("@/lib/supabase/server", () => ({ createClient: async () => supa }));
    const { reorderLessonsAction } = await import("./lessons");
    await expect(reorderLessonsAction("COURSE_Z" as any, ["L2", "L1"] as any)).rejects.toBeInstanceOf(Error);
    // ロールバックで original(0,1) に戻す試みが行われる想定
    expect(updates.some((u) => u.oi === 2_000_000)).toBe(true);
    expect(reval).not.toHaveBeenCalled();
  });
});

