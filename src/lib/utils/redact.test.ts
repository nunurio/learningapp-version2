import { describe, it, expect } from "vitest";
import { redactText, limitChars, buildPageContextText } from "./redact";

describe("redactText", () => {
  it("masks emails and phones", () => {
    const s = "mail test@example.com and phone +81-90-1234-5678 with token sk-abcdef0123456789ZZZ";
    const r = redactText(s);
    expect(r).not.toContain("test@example.com");
    expect(r).toMatch(/\*\*\*@\*\*\*\.com/);
    expect(r).not.toContain("1234-5678");
    expect(r).not.toContain("sk-abcdef");
  });
});

describe("limitChars", () => {
  it("limits to given size", () => {
    const s = "x".repeat(10);
    expect(limitChars(s, 5)).toBe("x".repeat(5));
  });
});

describe("buildPageContextText", () => {
  it("builds joined context", () => {
    const txt = buildPageContextText({ title: "T", url: "http://example.com", selection: "Hello" });
    expect(txt).toContain("Title: T");
    expect(txt).toContain("Hello");
  });
});

