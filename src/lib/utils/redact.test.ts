import { describe, it, expect } from "vitest";
import { redactText, limitChars, buildPageContextText } from "./redact";

describe("redactText", () => {
  it("masks emails, phones and token-like strings", () => {
    const input = "mail me at john.doe@example.com or +1-202-555-0199, key=sk-abcdef1234567890";
    const out = redactText(input);
    expect(out).not.toMatch(/john\.doe@example\.com/);
    expect(out).toMatch(/j\*\*\*@\*\*\*\.com/);
    // phone becomes coarse masked digits like 12***99 (country code may be stripped)
    expect(out).not.toMatch(/202-555-0199/);
    expect(out).toMatch(/\d{2}\*\*\*\d{2}/);
    expect(out).not.toMatch(/sk-[A-Za-z0-9_-]{12,}/);
  });
});

describe("limitChars", () => {
  it("truncates long strings but keeps short as-is", () => {
    expect(limitChars("abc", 5)).toBe("abc");
    const long = "x".repeat(20);
    expect(limitChars(long, 10)).toHaveLength(10);
  });
});

describe("buildPageContextText", () => {
  it("joins available fields and applies redaction/limit", () => {
    const ctx = {
      title: "My Title",
      url: "https://example.com/path",
      selection: "secret is sk-1234567890abcdef",
      headings: ["H1", "H2"],
      contentSnippet: "body...",
    };
    const text = buildPageContextText(ctx)!;
    expect(text).toMatch(/Title: My Title/);
    expect(text).toMatch(/URL: https:\/\/example.com\/path/);
    // token redacted
    expect(text).toMatch(/secret is \*\*\*/);
    // headings included
    expect(text).toMatch(/Headings: H1 \| H2/);
  });
});

