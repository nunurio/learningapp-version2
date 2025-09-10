import { describe, it, expect } from "vitest";
import { parseJsonWithQuery } from "./request";
import { z } from "zod";

function makeReq(url: string, body?: unknown): Request {
  return new Request(url, body === undefined
    ? { method: "GET" }
    : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
  );
}

describe("parseJsonWithQuery", () => {
  const schema = z.object({
    name: z.string().min(1),
    count: z.number().int().optional(),
    flag: z.boolean().optional(),
  });

  it("merges query then body with defaults", async () => {
    const req = makeReq("http://x.local/api?name=Q&count=2&flag=true", { name: "B", count: 5 });
    const res = await parseJsonWithQuery(req, schema, { name: "D" });
    // body が query を上書きする仕様（defaults < query < body）
    expect(res).toEqual({ name: "B", count: 5, flag: true });
  });

  it("applies defaults and types", async () => {
    const req = makeReq("http://x.local/api");
    const res = await parseJsonWithQuery(req, schema, { name: "D", count: 1 });
    expect(res).toEqual({ name: "D", count: 1 });
  });

  it("throws helpful error on invalid", async () => {
    const req = makeReq("http://x.local/api?count=aa");
    await expect(parseJsonWithQuery(req, schema, { name: "D" })).rejects.toThrow(/count/);
  });
});
