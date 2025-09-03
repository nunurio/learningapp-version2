import { describe, it, expect } from "vitest";
import { asUpsertById, type UpsertByIdInput } from "@/lib/db/helpers";

describe("db/helpers asUpsertById", () => {
  it("returns the same array reference (runtime is a pure cast)", () => {
    const input: UpsertByIdInput<"lessons">[] = [
      // Only id + subset of insert columns is required by the helper type
      { id: "l1", order_index: 3 } as any,
      { id: "l2", title: "Title" } as any,
    ];
    const out = asUpsertById<"lessons">(input);
    expect(out).toBe(input);
    expect(out[0]).toMatchObject({ id: "l1", order_index: 3 });
  });

  it("accepts other tables generically (e.g., cards)", () => {
    const rows: UpsertByIdInput<"cards">[] = [
      { id: "c1", order_index: 10, title: "t" } as any,
    ];
    const casted = asUpsertById<"cards">(rows);
    expect(casted[0]).toMatchObject({ id: "c1", order_index: 10, title: "t" });
  });
});

