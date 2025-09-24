import * as React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import MarkdownView from "@/components/markdown/MarkdownView";

describe("MarkdownView", () => {
  it("renders headings with slug id and autolink", () => {
    const md = "# Hello World";
    const { container } = render(<MarkdownView markdown={md} />);
    const h1 = container.querySelector("h1#hello-world");
    expect(h1).toBeInTheDocument();
    expect(h1).toHaveTextContent("Hello World");
    const link = container.querySelector("h1 a[href='#hello-world']");
    expect(link).toBeInTheDocument();
  });

  it("supports GFM task list and tables", () => {
    const md = `- [x] done\n- [ ] todo\n\n| A | B |\n|---|---|\n| 1 | 2 |`;
    const { container } = render(<MarkdownView markdown={md} />);
    // task list checkboxes (disabled by default)
    const boxes = container.querySelectorAll("input[type='checkbox']");
    expect(boxes.length).toBeGreaterThanOrEqual(2);
    // table rendered
    const table = container.querySelector("table");
    expect(table).toBeInTheDocument();
  });

  it("sanitizes dangerous links and raw HTML", () => {
    const md = `raw <script>alert(1)</script>\n\n[bad](javascript:alert(1))\n\n![img](javascript:alert(1))`;
    const { container } = render(<MarkdownView markdown={md} />);
    // raw HTML should not be executed nor rendered as elements
    expect(container.querySelector("script")).toBeNull();
    // javascript: links should be stripped or rendered inert
    const a = container.querySelector("a");
    if (a) {
      expect(a.getAttribute("href") ?? "").not.toMatch(/^javascript:/i);
    }
    const img = container.querySelector("img");
    if (img) {
      expect(img.getAttribute("src") ?? "").not.toMatch(/^javascript:/i);
    }
  });

  it("renders code blocks and inline code", () => {
    const md = "Here is `inline` code.\n\n```ts\nconst x: number = 1;\n```";
    const { container } = render(<MarkdownView markdown={md} />);
    expect(screen.getByText("inline")).toBeInTheDocument();
    const pre = container.querySelector("pre code");
    expect(pre).toBeInTheDocument();
    expect(pre).toHaveTextContent("const x: number = 1;");
  });

  it("renders inline and block LaTeX math", () => {
    const md = "エネルギーは $E = mc^2$ で表される。\n\n$$\\int_0^1 x^2 \\mathrm{d}x$$";
    const { container } = render(<MarkdownView markdown={md} />);
    const katexNodes = container.querySelectorAll("span.katex");
    expect(katexNodes.length).toBeGreaterThanOrEqual(2);
    const paragraphs = container.querySelectorAll("p");
    expect(paragraphs[0]?.querySelector("span.katex")).not.toBeNull();
    expect(paragraphs[1]?.querySelector("span.katex")).not.toBeNull();
    const mathMl = container.querySelectorAll("math");
    expect(mathMl.length).toBeGreaterThanOrEqual(2);
    const strut = container.querySelector("span.strut");
    expect(strut?.hasAttribute("style")).toBe(true);
  });

  it("allows safe http links", () => {
    const md = "See [site](https://example.com).";
    const { container } = render(<MarkdownView markdown={md} />);
    const a = container.querySelector("a[href='https://example.com']");
    expect(a).toBeInTheDocument();
    expect(a).toHaveTextContent("site");
  });

  it("supports inline variant without paragraph wrappers", () => {
    const md = "**Bold** math $a^2 + b^2 = c^2$.";
    const { container } = render(<MarkdownView markdown={md} variant="inline" />);
    // inline variant should not introduce block-level paragraphs
    expect(container.querySelector("p")).toBeNull();
    expect(container.textContent ?? "").toContain("Bold");
    const katex = container.querySelector("span.katex");
    expect(katex).toBeInTheDocument();
  });
});
