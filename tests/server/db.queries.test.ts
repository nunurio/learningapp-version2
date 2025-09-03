import { describe, it, expect, vi, beforeEach } from "vitest";

// supabase/server を丸ごとモック（hoist安全）
vi.mock("@/lib/supabase/server", () => {
  return {
    createClient: vi.fn(),
    getCurrentUserId: vi.fn(),
  };
});

// SUT をモックの後にimport
import { listFlaggedByCourse, getProgress, upsertSrs } from "@/lib/db/queries";
import * as supaServer from "@/lib/supabase/server";

type UUID = string;

function makeSupaMock(impl: Record<string, any>) {
  return {
    from(table: string) {
      if (!(table in impl)) throw new Error(`No mock for table: ${table}`);
      const handler = impl[table];
      return handler();
    },
  } as const;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("listFlaggedByCourse", () => {
  it("指定コースに紐づくフラグの card_id 配列を返す", async () => {
    const rows = [
      { card_id: "card-1" },
      { card_id: "card-2" },
    ];
    const supa = makeSupaMock({
      flags: () => ({
        select: () => ({
          eq: async () => ({ data: rows, error: null }),
        }),
      }),
    });

    vi.mocked(supaServer.createClient).mockResolvedValue(supa as any);

    const out = await listFlaggedByCourse("course-1");
    expect(out).toEqual(["card-1", "card-2"]);
  });
});

describe("getProgress", () => {
  it("null を undefined に正規化して返す", async () => {
    const row = {
      card_id: "card-x",
      completed: true,
      completed_at: null,
      answer: null,
    };
    const supa = makeSupaMock({
      progress: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: row, error: null }),
          }),
        }),
      }),
    });
    vi.mocked(supaServer.createClient).mockResolvedValue(supa as any);

    const out = await getProgress("card-x");
    expect(out).toEqual({
      cardId: "card-x",
      completed: true,
      completedAt: undefined,
      answer: undefined,
    });
  });

  it("値がある場合はそのままマップする", async () => {
    const row = {
      card_id: "card-y",
      completed: false,
      completed_at: "2025-09-01T00:00:00.000Z",
      answer: { ok: true },
    };
    const supa = makeSupaMock({
      progress: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: row, error: null }),
          }),
        }),
      }),
    });
    vi.mocked(supaServer.createClient).mockResolvedValue(supa as any);

    const out = await getProgress("card-y");
    expect(out).toEqual({
      cardId: "card-y",
      completed: false,
      completedAt: "2025-09-01T00:00:00.000Z",
      answer: { ok: true },
    });
  });

  it("行が存在しない場合は undefined", async () => {
    const supa = makeSupaMock({
      progress: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
    });
    vi.mocked(supaServer.createClient).mockResolvedValue(supa as any);

    const out = await getProgress("card-z");
    expect(out).toBeUndefined();
  });
});

describe("upsertSrs", () => {
  it("正常系: dueをYYYY-MM-DDにして送信し、ISOで返す。lastRatingはnull→undefined", async () => {
    const captured: { value?: any } = {};
    const supa = makeSupaMock({
      srs: () => ({
        upsert: (payload: any) => {
          captured.value = payload;
          return {
            select: () => ({
              maybeSingle: async () => ({
                data: {
                  card_id: payload.card_id,
                  ease: payload.ease,
                  interval: payload.interval,
                  due: payload.due, // サーバーからは日付文字列が返る想定
                  last_rating: null,
                },
                error: null,
              }),
            }),
          };
        },
      }),
    });
    vi.mocked(supaServer.createClient).mockResolvedValue(supa as any);
    vi.mocked(supaServer.getCurrentUserId).mockResolvedValue("user-1");

    const input = {
      cardId: "card-123" as UUID,
      ease: 2.5,
      interval: 5,
      due: "2025-09-03T12:34:56.789Z",
      lastRating: undefined,
    } as const;

    const out = await upsertSrs(input);

    // アップサート時は日付だけに丸めて送信
    expect(captured.value).toMatchObject({
      user_id: "user-1",
      card_id: "card-123",
      due: "2025-09-03",
    });

    // 返り値はISO。タイムゾーン差異を避けるため先頭一致を確認
    expect(out).toMatchObject({
      cardId: "card-123",
      ease: 2.5,
      interval: 5,
      lastRating: undefined,
    });
    expect(out.due.startsWith("2025-09-03")).toBe(true);
  });

  it("エラー系: PostgrestError をそのまま透過してthrowする", async () => {
    const pgErr = Object.assign(new Error("duplicate key value"), {
      name: "PostgrestError",
      code: "23505",
      details: "Key (id)=(...) already exists.",
      hint: null,
    });

    const supa = makeSupaMock({
      srs: () => ({
        upsert: () => ({
          select: () => ({
            maybeSingle: async () => ({ data: null, error: pgErr }),
          }),
        }),
      }),
    });
    vi.mocked(supaServer.createClient).mockResolvedValue(supa as any);
    vi.mocked(supaServer.getCurrentUserId).mockResolvedValue("user-2");

    await expect(
      upsertSrs({ cardId: "c", ease: 2, interval: 1, due: "2025-09-03" })
    ).rejects.toBe(pgErr); // 参照透過
  });
});
