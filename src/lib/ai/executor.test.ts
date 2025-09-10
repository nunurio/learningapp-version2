import { describe, it, expect } from "vitest";
import { extractAgentJSON, parseWithSchema } from "./executor";
import { z } from "zod";

describe("extractAgentJSON", () => {
  it("prefers object finalOutput", () => {
    const out = extractAgentJSON({ finalOutput: { a: 1 }, finalText: "{}" });
    expect(out).toEqual({ a: 1 });
  });
  it("parses string finalOutput as JSON", () => {
    const out = extractAgentJSON({ finalOutput: "{\"a\":2}" });
    expect(out).toEqual({ a: 2 });
  });
  it("parses finalText when no finalOutput", () => {
    const out = extractAgentJSON({ finalText: "{\"a\":3}" });
    expect(out).toEqual({ a: 3 });
  });
  it("returns undefined on invalid shape", () => {
    const out = extractAgentJSON(123);
    expect(out).toBeUndefined();
  });
});

describe("parseWithSchema", () => {
  it("validates with helpful message", () => {
    const schema = z.object({ a: z.string() });
    expect(() => parseWithSchema(schema, { a: 1 })).toThrowError(/at a/);
    expect(parseWithSchema(schema, { a: "ok" })).toEqual({ a: "ok" });
  });
});

