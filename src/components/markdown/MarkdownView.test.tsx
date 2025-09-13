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

  it("allows safe http links", () => {
    const md = "See [site](https://example.com).";
    const { container } = render(<MarkdownView markdown={md} />);
    const a = container.querySelector("a[href='https://example.com']");
    expect(a).toBeInTheDocument();
    expect(a).toHaveTextContent("site");
  });
});
