/* @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { UUID, CoursePlan, LessonCards } from "@/lib/types";

const planPayload: CoursePlan = {
  course: { title: "T", description: "D", category: "Cat" },
  lessons: [{ title: "L1" }, { title: "L2" }],
};

const cardsPayload: LessonCards = {
  lessonTitle: "L",
  cards: [
    { type: "text", body: "a" },
    { type: "quiz", question: "q", options: ["a","b"], answerIndex: 1 },
  ],
};

describe("server-actions/ai", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("saveDraftAction: 認証必須、insert→id返却", async () => {
    const supa = { from: vi.fn(() => ({ insert: () => ({ select: () => ({ single: async () => ({ data: { id: "D1" }, error: null }) }) }) })) } as const;
    vi.doMock("@/lib/supabase/server", () => ({ createClient: async () => supa, getCurrentUserId: async () => "U" }));
    const { saveDraftAction } = await import("./ai");
    const out = await saveDraftAction("outline", planPayload);
    expect(out.id).toBe("D1");
  });

  it("saveDraftAction: 未認証はエラー", async () => {
    vi.doMock("@/lib/supabase/server", () => ({ createClient: async () => ({}), getCurrentUserId: async () => undefined }));
    const { saveDraftAction } = await import("./ai");
    await expect(saveDraftAction("outline", planPayload as CoursePlan)).rejects.toThrow(/Not authenticated/);
  });

  it("commitCoursePlanAction: draft→course+lessons挿入→draft削除、courseId返却", async () => {
    const calls: Array<{ table: string; pay: unknown }> = [];
    const supa = {
      from: vi.fn((table: string) => {
        if (table === "ai_drafts") {
          return {
            select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "D1", kind: "outline", payload: planPayload }, error: null }) }) }) }) }),
            delete: () => ({ eq: async () => ({}) }),
          };
        }
        if (table === "courses") {
          return { insert: (pay: unknown) => { calls.push({ table, pay }); return { select: () => ({ single: async () => ({ data: { id: "C100" }, error: null }) }) } } };
        }
        if (table === "lessons") {
          return { insert: (pay: unknown) => { calls.push({ table, pay }); return { error: null } } };
        }
        throw new Error("unexpected table: " + table);
      }),
    } as const;
    vi.doMock("@/lib/supabase/server", () => ({ createClient: async () => supa, getCurrentUserId: async () => "U" }));
    const { commitCoursePlanAction } = await import("./ai");
    const out = await commitCoursePlanAction("D1");
    expect(out?.courseId).toBe("C100");
    // lessons は order_index 0..n-1
    const ls = calls.find((c) => c.table === "lessons")?.pay as Array<{ order_index: number }>;
    expect(Array.isArray(ls)).toBe(true);
    expect(ls?.[0]?.order_index).toBe(0);
    expect(ls?.[1]?.order_index).toBe(1);
  });

  it("commitCoursePlanPartialAction: 選択indexのみ追加、order_indexは0..n-1で再採番", async () => {
    const calls: unknown[] = [];
    const supa = {
      from: vi.fn((table: string) => {
        if (table === "ai_drafts") {
          return {
            select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "D1", kind: "outline", payload: planPayload }, error: null }) }) }) }) }),
            delete: () => ({ eq: async () => ({}) }),
          };
        }
        if (table === "courses") {
          return { insert: () => ({ select: () => ({ single: async () => ({ data: { id: "C200" }, error: null }) }) }) };
        }
        if (table === "lessons") {
          return { insert: (pay: unknown) => { (calls as unknown[]).push(pay); return { error: null } } };
        }
        throw new Error("unexpected table: " + table);
      }),
    } as const;
    vi.doMock("@/lib/supabase/server", () => ({ createClient: async () => supa, getCurrentUserId: async () => "U" }));
    const { commitCoursePlanPartialAction } = await import("./ai");
    await commitCoursePlanPartialAction("D1", [1]);
    const inserted = calls[0] as Array<{ order_index: number }>;
    expect(inserted.length).toBe(1);
    expect(inserted[0].order_index).toBe(0);
  });

  it("commitLessonCardsAction: siblingsの次indexから挿入、draft削除、workspace再検証", async () => {
    const calls: unknown[] = [];
    const supa = {
      from: vi.fn((table: string) => {
        if (table === "ai_drafts") {
          return {
            select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "D2", kind: "lesson-cards", payload: cardsPayload }, error: null }) }) }) }) }),
            delete: () => ({ eq: async () => ({}) }),
          };
        }
        if (table === "cards") {
          const q = {
            select: vi.fn(() => q),
            eq: vi.fn(() => q),
            order: vi.fn(() => q),
            limit: vi.fn(async () => ({ data: [{ order_index: 10 }], error: null })),
            insert: vi.fn((rows: unknown[]) => { (calls as unknown[]).push(rows); return { select: () => ({ data: [{ id: "K1" }, { id: "K2" }], error: null }) } }),
          };
          return q;
        }
        if (table === "lessons") {
          return { select: () => ({ eq: () => ({ single: async () => ({ data: { course_id: "COURSE_L" }, error: null }) }) }) };
        }
        throw new Error("unexpected table: " + table);
      }),
    } as const;
    const reval = vi.fn();
    vi.doMock("next/cache", () => ({ revalidatePath: reval }));
    vi.doMock("@/lib/supabase/server", () => ({ createClient: async () => supa, getCurrentUserId: async () => "U" }));
    const { commitLessonCardsAction } = await import("./ai");
    const out = await commitLessonCardsAction({ draftId: "D2", lessonId: "L1" as UUID });
    expect(out?.count).toBe(2);
    expect(reval).toHaveBeenCalledWith(`/courses/COURSE_L/workspace`, "page");
  });

  it("commitLessonCardsPartialAction: 選択indexのみ挿入し、draft削除→workspace再検証", async () => {
    const supa = {
      from: vi.fn((table: string) => {
        if (table === "ai_drafts") {
          return {
            select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "D2", kind: "lesson-cards", payload: cardsPayload }, error: null }) }) }) }) }),
            delete: () => ({ eq: async () => ({}) }),
          };
        }
        if (table === "cards") {
          const q = {
            select: vi.fn(() => q),
            eq: vi.fn(() => q),
            order: vi.fn(() => q),
            limit: vi.fn(async () => ({ data: [{ order_index: 1 }], error: null })),
            insert: vi.fn((_rows: unknown[]) => ({ select: () => ({ data: [{ id: "K" }], error: null }) })),
          };
          return q;
        }
        if (table === "lessons") {
          return { select: () => ({ eq: () => ({ single: async () => ({ data: { course_id: "COURSE_P" }, error: null }) }) }) };
        }
        throw new Error("unexpected table: " + table);
      }),
    } as const;
    const reval = vi.fn();
    vi.doMock("next/cache", () => ({ revalidatePath: reval }));
    vi.doMock("@/lib/supabase/server", () => ({ createClient: async () => supa, getCurrentUserId: async () => "U" }));
    const { commitLessonCardsPartialAction } = await import("./ai");
    const out = await commitLessonCardsPartialAction({ draftId: "D2", lessonId: "L1" as UUID, selectedIndexes: [1] });
    expect(out?.count).toBe(1);
    expect(reval).toHaveBeenCalledWith(`/courses/COURSE_P/workspace`, "page");
  });
});
