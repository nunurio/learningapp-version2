/* @vitest-environment node */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db/queries", () => ({
  listCourses: vi.fn(async () => [
    { id: "c1", title: "T", description: null, category: null, status: "draft", createdAt: "", updatedAt: "" },
  ]),
}));

describe("api/db POST", () => {
  it("未知の op は 400", async () => {
    const { POST } = await import("./route");
    const req = new Request("http://local/api/db", { method: "POST", body: JSON.stringify({ op: "__unknown__" }) });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it("listCourses は queries.listCourses の結果をそのまま返す", async () => {
    const { POST } = await import("./route");
    const req = new Request("http://local/api/db", { method: "POST", body: JSON.stringify({ op: "listCourses" }) });
    const res = await POST(req as any);
    const json = await res.json();
    expect(Array.isArray(json)).toBe(true);
    expect(json[0].id).toBe("c1");
  });
});
