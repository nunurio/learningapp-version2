import { describe, it, expect } from "vitest";
import { asUpsertById, type UpsertByIdInput } from "@/lib/db/helpers";

describe("db/helpers asUpsertById", () => {
  it("returns the same array reference (runtime is a pure cast)", () => {
    const input = [
      { id: "l1", order_index: 3 },
      { id: "l2", title: "Title" },
    ] satisfies UpsertByIdInput<"lessons">[];
    const out = asUpsertById<"lessons">(input);
    expect(out).toBe(input);
    expect(out[0]).toMatchObject({ id: "l1", order_index: 3 });
  });

  it("accepts other tables generically (e.g., cards)", () => {
    const rows = [
      { id: "c1", order_index: 10, title: "t" },
    ] satisfies UpsertByIdInput<"cards">[];
    const casted = asUpsertById<"cards">(rows);
    expect(casted[0]).toMatchObject({ id: "c1", order_index: 10, title: "t" });
  });
});
