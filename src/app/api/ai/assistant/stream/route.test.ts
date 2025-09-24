import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";

function makeReq(body: unknown) {
  return new Request("http://localhost/api/ai/assistant/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/ai/assistant/stream (mock)", () => {
  beforeEach(() => {
    process.env.AI_MOCK = "1";
    delete process.env.OPENAI_API_KEY;
  });

  it("streams a mock response and includes page context note", async () => {
    const res = await POST(
      makeReq({
        message: "これはテストです",
        includePage: true,
        page: { title: "T", url: "https://e.x/", selection: "ABC" },
        history: [{ role: "user", content: "h" }],
      }) as unknown as Request
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type") || "").toMatch(/text\/plain/);
    const text = await (res as Response).text();
    expect(text).toMatch(/質問: これはテストです/);
    expect(text).toMatch(/参照した文脈/);
  });

  it("returns 400 on invalid body", async () => {
    const res = await POST(makeReq({ message: "" }) as unknown as Request);
    expect(res.status).toBe(400);
    const body: unknown = await (res as Response).json();
    expect(body).toHaveProperty("error");
  });

  it("sets X-Thread-Id header when persistence is available", async () => {
    const tid = "11111111-1111-4111-8111-111111111111";
    vi.doMock("@/lib/supabase/server", () => {
      type FromReturn = {
        insert: (_v: unknown) => { select: (_s: string) => { single: () => { data: unknown; error: null } } };
        update: (_v: unknown) => { eq: () => { error: null } };
        select: (_s: string) => { maybeSingle: () => { data: unknown; error: null } };
        order: (_col?: string, _opts?: unknown) => { data: unknown[]; error: null };
        eq: (_c?: string, _v?: unknown) => { order: (_col?: string, _opts?: unknown) => { data: unknown[]; error: null } };
        delete: () => { eq: (_c?: string, _v?: unknown) => { error: null } };
      };
      const stub = {
        from(table: string): FromReturn {
          return {
            insert: (_v: unknown) => ({
              select: (_s: string) => ({ single: () => ({ data: table === "chat_threads" ? { id: tid } : { id: "m1" }, error: null }) }),
            }),
            update: (_v: unknown) => ({ eq: () => ({ error: null }) }),
            select: (_s: string) => ({ maybeSingle: () => ({ data: { id: tid }, error: null }) }),
            order: () => ({ data: [], error: null }),
            eq: () => ({ order: () => ({ data: [], error: null }) }),
            delete: () => ({ eq: () => ({ error: null }) }),
          } as FromReturn;
        },
      };
      return {
        createClient: async () => stub,
        getCurrentUserId: async () => "user-1",
      };
    });
    // Import inside mocked context (re-require module under test won't help since route.ts captures import inside function)
    const { POST: POST2 } = await import("./route");
    const res = await POST2(
      makeReq({ message: "persist", includePage: false }) as unknown as Request
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Thread-Id")).toBe(tid);
    const text = await (res as Response).text();
    expect(text.length).toBeGreaterThan(0);
  });
});
