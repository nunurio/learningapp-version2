/* @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("server-actions/cards", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("addCardAction: siblingsの最大index+1で挿入→コースworkspace再検証", async () => {
    const calls: any[] = [];
    const supa: any = {
      from: vi.fn((table: string) => {
        if (table === "lessons") {
          return {
            select: () => ({ eq: () => ({ single: async () => ({ data: { course_id: "COURSE1" }, error: null }) }) }),
          };
        }
        if (table === "cards") {
          const q: any = {};
          q.select = vi.fn(() => q);
          q.eq = vi.fn(() => q);
          q.order = vi.fn(() => q);
          q.limit = vi.fn(async () => ({ data: [{ order_index: 7 }], error: null }));
          q.insert = vi.fn((payload: any) => {
            calls.push({ op: "insert", payload });
            return { select: () => ({ single: async () => ({ data: { id: "CARD_NEW" }, error: null }) }) };
          });
          return q;
        }
        throw new Error("unexpected table: " + table);
      }),
    };
    const reval = vi.fn();
    vi.doMock("next/cache", () => ({ revalidatePath: reval }));
    vi.doMock("@/lib/supabase/server", () => ({ createClient: async () => supa }));
    const { addCardAction } = await import("./cards");
    const id = await addCardAction("LESSON_X" as any, { cardType: "text", content: { body: "b" }, title: null });
    expect(id).toBe("CARD_NEW");
    expect(calls[0].payload).toMatchObject({ lesson_id: "LESSON_X", order_index: 8 });
    expect(reval).toHaveBeenCalledWith(`/courses/COURSE1/workspace`, "page");
  });

  it("updateCardAction: 差分のみ更新し、workspace を再検証", async () => {
    const updates: any[] = [];
    const supa: any = {
      from: vi.fn((table: string) => {
        if (table === "cards") {
          return {
            select: () => ({ eq: () => ({ single: async () => ({ data: { lesson_id: "LESSON_A" }, error: null }) }) }),
            update: (payload: any) => ({ eq: async () => { updates.push(payload); return { error: null }; } }),
          };
        }
        if (table === "lessons") {
          return { select: () => ({ eq: () => ({ single: async () => ({ data: { course_id: "COURSE_A" }, error: null }) }) }) };
        }
        throw new Error("unexpected table: " + table);
      }),
    };
    const reval = vi.fn();
    vi.doMock("next/cache", () => ({ revalidatePath: reval }));
    vi.doMock("@/lib/supabase/server", () => ({ createClient: async () => supa }));
    const { updateCardAction } = await import("./cards");
    await updateCardAction("CARD_1" as any, { title: "T", orderIndex: 3 });
    expect(updates[0]).toEqual({ title: "T", order_index: 3 });
    expect(reval).toHaveBeenCalledWith(`/courses/COURSE_A/workspace`, "page");
  });

  it("deleteCardAction: 削除後に再検証（lessonsの取得が失敗したらrevalidateしない）", async () => {
    const supa: any = {
      from: vi.fn((table: string) => {
        if (table === "cards") {
          return {
            select: () => ({ eq: () => ({ single: async () => ({ data: { lesson_id: "LESSON_Y" }, error: null }) }) }),
            delete: () => ({ eq: async () => ({ error: null }) }),
          };
        }
        if (table === "lessons") {
          return { select: () => ({ eq: () => ({ single: async () => ({ data: null, error: Object.assign(new Error("nf"), { code: "P0001" }) }) }) }) };
        }
        throw new Error("unexpected table: " + table);
      }),
    };
    const reval = vi.fn();
    vi.doMock("next/cache", () => ({ revalidatePath: reval }));
    vi.doMock("@/lib/supabase/server", () => ({ createClient: async () => supa }));
    const { deleteCardAction } = await import("./cards");
    await deleteCardAction("CARD_DEL" as any);
    expect(reval).not.toHaveBeenCalled();
  });

  it("deleteCardsAction: 空配列なら何もしない", async () => {
    const supa: any = { from: vi.fn() };
    vi.doMock("@/lib/supabase/server", () => ({ createClient: async () => supa }));
    const { deleteCardsAction } = await import("./cards");
    await deleteCardsAction([]);
    expect(supa.from).not.toHaveBeenCalled();
  });

  it("deleteCardsAction: 一括削除→workspace再検証（最初のレッスンからコース解決）", async () => {
    const supa: any = {
      from: vi.fn((table: string) => {
        if (table === "cards") {
          return {
            select: () => ({ in: async () => ({ data: [{ lesson_id: "LZ" }], error: null }) }),
            delete: () => ({ in: async () => ({ error: null }) }),
          };
        }
        if (table === "lessons") {
          return { select: () => ({ eq: () => ({ single: async () => ({ data: { course_id: "COURSE_Z" }, error: null }) }) }) };
        }
        throw new Error("unexpected table: " + table);
      }),
    };
    const reval = vi.fn();
    vi.doMock("next/cache", () => ({ revalidatePath: reval }));
    vi.doMock("@/lib/supabase/server", () => ({ createClient: async () => supa }));
    const { deleteCardsAction } = await import("./cards");
    await deleteCardsAction(["A", "B"] as any);
    expect(reval).toHaveBeenCalledWith(`/courses/COURSE_Z/workspace`, "page");
  });

  it("reorderCardsAction: 集合不一致ならエラー", async () => {
    const supa: any = {
      from: vi.fn((table: string) => {
        if (table === "lessons") return { select: () => ({ eq: () => ({ single: async () => ({ data: { course_id: "C1" }, error: null }) }) }) };
        if (table === "cards") {
          return { select: () => ({ eq: () => ({ order: async () => ({ data: [{ id: "X" }], error: null }) }) }) };
        }
        throw new Error("unexpected table: " + table);
      }),
    };
    vi.doMock("@/lib/supabase/server", () => ({ createClient: async () => supa }));
    const { reorderCardsAction } = await import("./cards");
    await expect(reorderCardsAction("L1" as any, ["X", "Y"] as any)).rejects.toBeInstanceOf(Error);
  });

  it("reorderCardsAction: 正常系は2段階更新→workspace再検証", async () => {
    const updates: any[] = [];
    const supa: any = {
      from: vi.fn((table: string) => {
        if (table === "lessons") return { select: () => ({ eq: () => ({ single: async () => ({ data: { course_id: "COURSE_R" }, error: null }) }) }) };
        if (table === "cards") {
          return {
            select: () => ({ eq: () => ({ order: async () => ({ data: [
              { id: "A", order_index: 0 },
              { id: "B", order_index: 1 },
              { id: "C", order_index: 2 },
            ], error: null }) }) }),
            update: (payload: any) => ({ eq: (_k: string, v: string) => ({ eq: async () => { updates.push({ id: v, oi: payload.order_index }); return { error: null }; } }) }),
          };
        }
        throw new Error("unexpected table: " + table);
      }),
    };
    const reval = vi.fn();
    vi.doMock("next/cache", () => ({ revalidatePath: reval }));
    vi.doMock("@/lib/supabase/server", () => ({ createClient: async () => supa }));
    const { reorderCardsAction } = await import("./cards");
    await reorderCardsAction("L1" as any, ["C", "A", "B"] as any);
    expect(updates.length).toBe(6); // 3 + 3
    expect(updates.some((u) => u.oi === 0)).toBe(true);
    expect(updates.some((u) => u.oi === 1)).toBe(true);
    expect(updates.some((u) => u.oi === 2)).toBe(true);
    expect(reval).toHaveBeenCalledWith(`/courses/COURSE_R/workspace`, "page");
  });

  it("reorderCardsAction: Phase2で失敗→ロールバックを試みてthrow", async () => {
    const updates: any[] = [];
    let hitPhase2 = false;
    const supa: any = {
      from: vi.fn((table: string) => {
        if (table === "lessons") return { select: () => ({ eq: () => ({ single: async () => ({ data: { course_id: "COURSE_R" }, error: null }) }) }) };
        if (table === "cards") {
          return {
            select: () => ({ eq: () => ({ order: async () => ({ data: [
              { id: "A", order_index: 0 },
              { id: "B", order_index: 1 },
            ], error: null }) }) }),
            update: (payload: any) => ({
              eq: (_k: string, v: string) => ({
                eq: async () => {
                  // Phase2 は小さな index(0,1) を設定する更新
                  if (!hitPhase2 && typeof payload.order_index === "number" && payload.order_index < 1_000_000 && v === "A") {
                    hitPhase2 = true;
                    return { error: Object.assign(new Error("phase2 fail"), { code: "23514" }) };
                  }
                  updates.push({ id: v, oi: payload.order_index });
                  return { error: null };
                },
              }),
            }),
          };
        }
        throw new Error("unexpected table: " + table);
      }),
    };
    const reval = vi.fn();
    vi.doMock("next/cache", () => ({ revalidatePath: reval }));
    vi.doMock("@/lib/supabase/server", () => ({ createClient: async () => supa }));
    const { reorderCardsAction } = await import("./cards");
    await expect(reorderCardsAction("L1" as any, ["B", "A"] as any)).rejects.toBeInstanceOf(Error);
    expect(updates.some((u) => u.oi === 2_000_000)).toBe(true); // ロールバック staging 窓
    expect(reval).not.toHaveBeenCalled();
  });
});

