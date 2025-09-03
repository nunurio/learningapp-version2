/* @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from "vitest";

// 動的モック: 最小限のメソッドチェーンを提供
function createSupabaseMock(fixtures: Record<string, any[]>) {
  const supa: any = {};
  supa.from = vi.fn((table: string) => {
    const state: any = { _table: table, _where: [], _order: [] };
    const q: any = {
      select: vi.fn((_sel?: string) => q),
      order: vi.fn((col?: string) => {
        state._order.push(col);
        // await チェーンの末尾で {data,error} を返せるよう thenable を提供
        return q;
      }),
      eq: vi.fn((col: string, val: any) => {
        state._where.push([col, val]);
        return q;
      }),
      in: vi.fn((col: string, arr: any[]) => {
        state._where.push([col, arr]);
        return q;
      }),
      limit: vi.fn(() => q),
      single: vi.fn(() => ({ data: { id: "new-id" }, error: null })),
      maybeSingle: vi.fn(() => {
        const rows = resolveRows(state);
        return { data: rows[0] ?? null, error: null };
      }),
      then: (resolve: any) => {
        const rows = resolveRows(state);
        resolve({ data: rows, error: null });
      },
    };
    function resolveRows(st: any) {
      let rows = (fixtures[st._table] ?? []).slice();
      for (const [col, val] of st._where) {
        rows = rows.filter((r: any) => {
          if (Array.isArray(val)) return val.includes((r as any)[col]);
          return (r as any)[col] === val;
        });
      }
      return rows;
    }
    return q;
  });
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
        { user_id: "u", card_id: "k1", text: "memo", updated_at: "2024-01-07" },
      ],
    } as Record<string, any[]>;

    const supa = createSupabaseMock(fixtures);
    vi.doMock("@/lib/supabase/server", () => ({ createClient: async () => supa }));
    const { snapshot } = await import("@/lib/db/queries");
    const data = await snapshot();

    expect(data.courses[0]).toMatchObject({ id: "c1", title: "T", status: "draft" });
    expect(data.lessons[0]).toMatchObject({ id: "l1", courseId: "c1", title: "L1" });
    expect(data.cards[0]).toMatchObject({ id: "k1", lessonId: "l1", cardType: "text" });
    expect(data.progress[0]).toMatchObject({ cardId: "k1", completed: true });
    expect(data.flags[0]).toMatchObject({ cardId: "k1" });
    expect(data.notes[0]).toMatchObject({ cardId: "k1", text: "memo" });
  });

  it("getNote: cardId に一致しない場合は undefined", async () => {
    const supa = createSupabaseMock({ notes: [] });
    vi.doMock("@/lib/supabase/server", () => ({ createClient: async () => supa }));
    const { getNote } = await import("@/lib/db/queries");
    const text = await getNote("dead-beef" as any);
    expect(text).toBeUndefined();
  });
});

