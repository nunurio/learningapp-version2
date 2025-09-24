import { describe, it, expect } from "vitest";

import { normalizeFillBlankText } from "./fill-blank";

describe("normalizeFillBlankText", () => {
  it("replaces line breaks around placeholders with spaces", () => {
    expect(normalizeFillBlankText("A\n[[1]]\nB")).toBe("A [[1]] B");
  });

  it("handles consecutive placeholders", () => {
    expect(normalizeFillBlankText("[[1]]\n[[2]]")).toBe("[[1]] [[2]]");
  });

  it("trims whitespace padding placeholders", () => {
    expect(normalizeFillBlankText("A\n  [[1]]  \nB")).toBe("A [[1]] B");
  });

  it("keeps other paragraphs intact", () => {
    const source = "前段落\n\n後段落";
    expect(normalizeFillBlankText(source)).toBe(source);
  });

  it("preserves paragraph breaks around placeholders", () => {
    const source = "イントロ文\n\n[[1]]\n\n別段落";
    expect(normalizeFillBlankText(source)).toBe(source);
  });

  it("normalizes the quadratic function sample", () => {
    const sample = "二次関数 $y=ax^2+bx+c$ を平方完成すると $y=a(x-p)^2+q$ の形になる。このとき放物線の[[1]]は$(p, q)$、[[2]]は$x=p$。$a>0$なら開きは上向きで[[3]]をもち、その値は$y=q$、それを[[4]]は$x=p$でとる。$a<0$なら開きは下向きで[[5]]をもち、その値は$y=q$、それを[[6]]は$x=p$でとる。[[7]]は、$a>0$のとき$y\\ge q$、$a<0$のとき$y\\le q$。区間$[m,n]$に限定するときは、[[8]]$x=m$と[[9]]$x=n$における値、そして[[2]]が区間内にあればその値を比べて最大・最小を決める。";
    const normalized = normalizeFillBlankText(sample);
    expect(normalized).not.toMatch(/\n\s*\[\[(\d+)\]\]/);
    expect(normalized).not.toMatch(/\[\[(\d+)\]\]\s*\n/);
    expect(normalized.includes("\n")).toBe(false);
  });
});
