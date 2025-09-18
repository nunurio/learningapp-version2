"use client";
import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import type { Schema } from "hast-util-sanitize";
import type { Components } from "react-markdown";
import type { PluggableList } from "unified";
import { cn } from "@/lib/utils/cn";

type Props = {
  markdown: string;
  className?: string;
  variant?: "block" | "inline";
  components?: Components;
  remarkPlugins?: PluggableList;
  rehypePlugins?: PluggableList;
};

const katexTagNames = new Set(defaultSchema.tagNames ?? []);
[
  "math",
  "annotation",
  "semantics",
  "mrow",
  "mn",
  "mi",
  "mo",
  "ms",
  "mtext",
  "mfrac",
  "msup",
  "msub",
  "msubsup",
  "mover",
  "munder",
  "munderover",
  "mtable",
  "mtr",
  "mtd",
  "mroot",
  "mpadded",
  "mphantom",
  "menclose",
].forEach((tag) => katexTagNames.add(tag));

const wildcardAttributes = new Set(defaultSchema.attributes?.["*"] ?? []);
wildcardAttributes.add("className");

const katexAttributes: NonNullable<Schema["attributes"]> = {
  ...defaultSchema.attributes,
  "*": Array.from(wildcardAttributes),
  div: [
    ...(defaultSchema.attributes?.div ?? []),
    "className",
    ["className", true],
    "style",
  ],
  span: [
    ...(defaultSchema.attributes?.span ?? []),
    "className",
    ["className", true],
    "style",
  ],
  math: [
    ...(defaultSchema.attributes?.math ?? []),
    ["xmlns", "http://www.w3.org/1998/Math/MathML"],
    ["display", true],
  ],
  annotation: [
    ...(defaultSchema.attributes?.annotation ?? []),
    ["encoding", "application/x-tex"],
  ],
};

[
  "semantics",
  "mrow",
  "mn",
  "mi",
  "mo",
  "ms",
  "mtext",
  "mfrac",
  "msup",
  "msub",
  "msubsup",
  "mover",
  "munder",
  "munderover",
  "mtable",
  "mtr",
  "mtd",
  "mroot",
  "mpadded",
  "mphantom",
  "menclose",
].forEach((tag) => {
  if (!katexAttributes[tag]) {
    katexAttributes[tag] = defaultSchema.attributes?.[tag] ?? [];
  }
});

const katexSanitizeSchema: Schema = {
  ...defaultSchema,
  tagNames: Array.from(katexTagNames),
  attributes: katexAttributes,
};

const inlineComponents: Components = {
  p: ({ children }) => <>{children}</>,
};

const defaultRemarkPlugins: PluggableList = [remarkGfm, remarkMath];
const defaultRehypePlugins: PluggableList = [
  rehypeKatex,
  [rehypeSanitize, katexSanitizeSchema],
  rehypeSlug,
  [rehypeAutolinkHeadings, { behavior: "append" }],
];

export function MarkdownView({ markdown, className, variant = "block", components, remarkPlugins, rehypePlugins }: Props) {
  const Root = variant === "inline" ? "span" : "article";
  const combinedRemark = React.useMemo(() => {
    return [...defaultRemarkPlugins, ...(remarkPlugins ?? [])];
  }, [remarkPlugins]);
  const combinedRehype = React.useMemo(() => {
    return [...defaultRehypePlugins, ...(rehypePlugins ?? [])];
  }, [rehypePlugins]);
  const resolvedComponents = React.useMemo(() => {
    if (variant === "inline") {
      return { ...inlineComponents, ...(components ?? {}) };
    }
    return components;
  }, [components, variant]);
  return (
    <Root
      className={cn(
        "markdown-body",
        variant === "inline" && "markdown-inline",
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={combinedRemark}
        rehypePlugins={combinedRehype}
        components={resolvedComponents}
      >
        {markdown || ""}
      </ReactMarkdown>
    </Root>
  );
}

export default MarkdownView;
