/* @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from "vitest";

// 動的モック: 最小限のメソッドチェーンを提供（any を使わず unknown で管理）
function createSupabaseMock(fixtures: Record<string, unknown[]>) {
  const supa = {
    from: vi.fn((table: string) => {
      const state = { _table: table, _where: [] as Array<[string, unknown]>, _order: [] as string[] };
      const q = {
        select: vi.fn((_sel?: string) => q),
        order: vi.fn((col?: string) => {
          if (col) state._order.push(col);
          return q;
        }),
        eq: vi.fn((col: string, val: unknown) => {
          state._where.push([col, val]);
          return q;
        }),
        in: vi.fn((col: string, arr: unknown[]) => {
          state._where.push([col, arr]);
          return q;
        }),
        limit: vi.fn(() => q),
        single: vi.fn(() => ({ data: { id: "new-id" }, error: null })),
        maybeSingle: vi.fn(() => {
          const rows = resolveRows(state);
          return { data: (rows[0] ?? null) as unknown, error: null };
        }),
        then: (resolve: (arg: { data: unknown[]; error: null }) => void) => {
          const rows = resolveRows(state);
          resolve({ data: rows, error: null });
        },
      };
      function resolveRows(st: { _table: string; _where: Array<[string, unknown]> }) {
        let rows = (fixtures[st._table] ?? []).slice();
        for (const [col, val] of st._where) {
          rows = rows.filter((r) => {
            const rec = r as Record<string, unknown>;
            if (Array.isArray(val)) return (val as unknown[]).includes(rec[col] as unknown);
            return rec[col] === val;
          });
        }
        return rows;
      }
      return q;
    }),
  };
  return supa;
}

describe("lib/db/queries", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("snapshot: すべてのテーブルを集約してドメインにマップする", async () => {
    const fixtures = {
      courses: [
        { id: "c1", title: "T", description: null, category: null, status: "draft", created_at: "2024-01-01", updated_at: "2024-01-02", owner_id: "u", slug: null },
      ],
      lessons: [
        { id: "l1", course_id: "c1", title: "L1", order_index: 0, created_at: "2024-01-03" },
      ],
      cards: [
        { id: "k1", lesson_id: "l1", card_type: "text", title: null, tags: [], content: { type: "text", body: "b" }, order_index: 0, created_at: "2024-01-04" },
      ],
      progress: [
        { user_id: "u", card_id: "k1", completed: true, completed_at: "2024-01-05", answer: null },
      ],
      flags: [
        { user_id: "u", card_id: "k1", flagged_at: "2024-01-06" },
      ],
      notes: [
        {
          id: "note-1",
          user_id: "u",
          card_id: "k1",
          text: "memo",
          created_at: "2024-01-06",
          updated_at: "2024-01-07",
        },
        {
          id: "note-2",
          user_id: "u",
          card_id: "k1",
          text: "memo-2",
          created_at: "2024-01-08",
          updated_at: "2024-01-09",
        },
      ],
    } as Record<string, unknown[]>;

    const supa = createSupabaseMock(fixtures);
    vi.doMock("@/lib/supabase/server", () => ({ createClient: async () => supa }));
    const { snapshot } = await import("@/lib/db/queries");
    const data = await snapshot();

    expect(data.courses[0]).toMatchObject({ id: "c1", title: "T", status: "draft" });
    expect(data.lessons[0]).toMatchObject({ id: "l1", courseId: "c1", title: "L1" });
    expect(data.cards[0]).toMatchObject({ id: "k1", lessonId: "l1", cardType: "text" });
    expect(data.progress[0]).toMatchObject({ cardId: "k1", completed: true });
    expect(data.flags[0]).toMatchObject({ cardId: "k1" });
    expect(data.notes[0]).toMatchObject({ id: "note-1", cardId: "k1", text: "memo" });
    expect(data.notes[1]).toMatchObject({ id: "note-2", createdAt: "2024-01-08" });
  });

  it("listNotes: cardId に一致しない場合は空配列", async () => {
    const supa = createSupabaseMock({ notes: [] });
    vi.doMock("@/lib/supabase/server", () => ({ createClient: async () => supa }));
    const { listNotes } = await import("@/lib/db/queries");
    const notes = await listNotes("dead-beef");
    expect(notes).toEqual([]);
  });
});
