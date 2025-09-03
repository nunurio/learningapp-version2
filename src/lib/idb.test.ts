import { describe, it, expect, beforeEach } from "vitest";
import { draftsAll, draftsDelete, draftsGet, draftsPut, type DraftRow } from "@/lib/idb";

// jsdom + fake-indexeddb は tests/setup.client.ts で自動登録

describe("idb drafts helpers", () => {
  const base: DraftRow = {
    key: "card:abc",
    cardId: "abc",
    cardType: "text",
    title: "t",
    data: { body: "hello" },
    updatedAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    // クリア: 既存があれば消す
    const all = await draftsAll().catch(() => [] as DraftRow[]);
    await Promise.all(all.map((r) => draftsDelete(r.key))).catch(() => {});
  });

  it("put → get → all → delete の基本動作", async () => {
    await draftsPut(base);
    const got = await draftsGet(base.key);
    expect(got?.cardId).toBe("abc");
    expect(got?.data).toEqual({ body: "hello" });

    const all1 = await draftsAll();
    expect(all1.length).toBe(1);
    expect(all1[0].key).toBe(base.key);

    await draftsDelete(base.key);
    const none = await draftsGet(base.key);
    expect(none).toBeUndefined();
  });
});

