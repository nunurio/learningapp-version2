import { describe, it, expect } from "vitest";
import { z } from "zod";
import { parseJsonWithQuery } from "./request";

const Schema = z.object({
  a: z.number().optional(),
  b: z.boolean().optional(),
  c: z.string().optional(),
  d: z.number().optional(),
});

async function makeReq(url: string, body?: unknown) {
  return new Request(url, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("parseJsonWithQuery", () => {
  it("merges query and JSON body with type coercion", async () => {
    const req = await makeReq("http://test.local/p?a=1&b=true&c=str", { d: 4 });
    const out = await parseJsonWithQuery(req, Schema);
    expect(out).toEqual({ a: 1, b: true, c: "str", d: 4 });
  });

  it("throws when query has non-numeric for number field", async () => {
    const req = await makeReq("http://x.local/p?a=notnum&b=false");
    await expect(parseJsonWithQuery(req, Schema)).rejects.toThrow(/at a/);
  });

  it("throws on schema violation with helpful path", async () => {
    const Bad = z.object({ n: z.number() });
    const req = await makeReq("http://x.local/p", { n: "nope" });
    await expect(parseJsonWithQuery(req, Bad)).rejects.toThrow(/at n/);
  });
});
