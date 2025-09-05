/* @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { UUID, SrsRating } from "@/lib/types";

describe("server-actions/progress", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("saveProgressAction: 認証必須、upsertで保存", async () => {
    const captured: Array<{ t: string; payload: unknown }> = [];
    const supa = {
      from: vi.fn((t: string) => ({
        select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
        upsert: (payload: unknown) => { captured.push({ t, payload }); return { error: null }; },
      })),
    } as const;
    vi.doMock("@/lib/supabase/server", () => ({ createClient: async () => supa, getCurrentUserId: async () => "user-1" }));
    const { saveProgressAction } = await import("./progress");
    await saveProgressAction({ cardId: "C1" as UUID, completed: true, completedAt: undefined, answer: undefined });
    expect(captured[0].t).toBe("progress");
    expect(captured[0].payload).toMatchObject({ user_id: "user-1", card_id: "C1", completed: true, completed_at: null, answer: null });
  });

  it("saveProgressAction: answer はオブジェクト同士ならフィールドマージ", async () => {
    const captured: Array<{ t: string; payload: Record<string, unknown> }> = [];
    const supa = {
      from: vi.fn((t: string) => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { completed: true, completed_at: "2025-09-01T00:00:00.000Z", answer: { selected: 2, result: "correct" } },
                error: null,
              }),
            }),
          }),
        }),
        upsert: (payload: Record<string, unknown>) => {
          captured.push({ t, payload });
          return { error: null };
        },
      })),
    } as const;
    vi.doMock("@/lib/supabase/server", () => ({ createClient: async () => supa, getCurrentUserId: async () => "U" }));
    const { saveProgressAction } = await import("./progress");
    await saveProgressAction({ cardId: "C1" as UUID, completed: false, answer: { level: 4 } });
    expect(captured[0].payload).toMatchObject({
      user_id: "U",
      card_id: "C1",
      completed: true, // 既存が true なら維持
      completed_at: "2025-09-01T00:00:00.000Z",
      answer: { selected: 2, result: "correct", level: 4 }, // 既存 + 追加分がマージされる
    });
  });

  it("saveProgressAction: 未認証はエラー", async () => {
    vi.doMock("@/lib/supabase/server", () => ({ createClient: async () => ({}), getCurrentUserId: async () => undefined }));
    const { saveProgressAction } = await import("./progress");
    await expect(saveProgressAction({ cardId: "C1" as UUID, completed: false })).rejects.toThrow(/Not authenticated/);
  });

  it("rateSrsAction: again → ease減/interval=0/当日0時のdue、upsertされる", async () => {
    vi.setSystemTime(new Date("2025-09-03T10:00:00.000Z"));
    const captured: unknown[] = [];
    const supa = {
      from: vi.fn((t: string) => {
        if (t === "srs") {
          return {
            select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { ease: 2.5, interval: 5 }, error: null }) }) }) }),
            upsert: (payload: unknown) => { captured.push(payload); return { error: null }; },
          };
        }
        throw new Error("unexpected table: " + t);
      }),
    } as const;
    vi.doMock("@/lib/supabase/server", () => ({ createClient: async () => supa, getCurrentUserId: async () => "U" }));
    const { rateSrsAction } = await import("./progress");
    const out = await rateSrsAction("CARD_A" as UUID, "again");
    expect(out.interval).toBe(0);
    expect(out.ease).toBeCloseTo(2.3, 5);
    const expectedDay = (() => { const d = new Date("2025-09-03T10:00:00.000Z"); d.setHours(0,0,0,0); return d.toISOString().slice(0,10); })();
    expect(out.due.slice(0,10)).toBe(expectedDay);
    expect(captured[0]).toMatchObject({ user_id: "U", card_id: "CARD_A", due: expectedDay, last_rating: "again" });
  });

  it("rateSrsAction: hard/good/easy の分岐", async () => {
    vi.setSystemTime(new Date("2025-09-03T00:00:00.000Z"));
    const ups: unknown[] = [];
    const supa = {
      from: vi.fn((t: string) => ({
        select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { ease: 2.5, interval: 5 }, error: null }) }) }) }),
        upsert: (payload: unknown) => { ups.push(payload); return { error: null }; },
      })),
    } as const;
    vi.doMock("@/lib/supabase/server", () => ({ createClient: async () => supa, getCurrentUserId: async () => "U" }));
    const { rateSrsAction } = await import("./progress");
    const hard = await rateSrsAction("C1" as UUID, "hard" as SrsRating);
    expect(hard.interval).toBeGreaterThanOrEqual(1);
    const good = await rateSrsAction("C1" as UUID, "good" as SrsRating);
    expect(good.interval).toBeGreaterThan(5); // おおむね * ease
    const easy = await rateSrsAction("C1" as UUID, "easy" as SrsRating);
    expect(easy.interval).toBeGreaterThan(good.interval - 1); // だいたい *1.3
    expect(ups.length).toBe(3); // 3回upsert
  });

  it("toggleFlagAction: 行が無ければinsert→true、あればdelete→false", async () => {
    let has = false;
    const supa = {
      from: vi.fn((t: string) => {
        if (t !== "flags") throw new Error("unexpected table: " + t);
        return {
          select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: has ? { user_id: "U", card_id: "C" } : null, error: null }) }) }) }),
          insert: () => ({ error: null }),
          delete: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
        };
      }),
    } as const;
    vi.doMock("@/lib/supabase/server", () => ({ createClient: async () => supa, getCurrentUserId: async () => "U" }));
    const { toggleFlagAction } = await import("./progress");
    const t1 = await toggleFlagAction("C" as UUID);
    expect(t1).toBe(true);
    has = true;
    const t2 = await toggleFlagAction("C" as UUID);
    expect(t2).toBe(false);
  });

  it("saveNoteAction: upsertで保存", async () => {
    const captured: unknown[] = [];
    const supa = { from: vi.fn((t: string) => ({ upsert: (payload: unknown) => { captured.push(payload); return { error: null }; } })) } as const;
    vi.doMock("@/lib/supabase/server", () => ({ createClient: async () => supa, getCurrentUserId: async () => "U" }));
    const { saveNoteAction } = await import("./progress");
    await saveNoteAction("CARD" as UUID, "text");
    expect(captured[0]).toMatchObject({ user_id: "U", card_id: "CARD", text: "text" });
  });
});
