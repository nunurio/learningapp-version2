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

type UnknownRecord = Record<string, unknown>;
type AttributeList = readonly unknown[];
type AttributeMap = Record<string, AttributeList>;

const isAttributeList = (value: unknown): value is AttributeList => Array.isArray(value);

const cloneAttributeMap = (value: unknown): AttributeMap => {
  if (!value || typeof value !== "object") return {};
  const entries = value as UnknownRecord;
  const result: AttributeMap = {};
  for (const [key, list] of Object.entries(entries)) {
    if (isAttributeList(list)) {
      result[key] = [...list];
    }
  }
  return result;
};

const katexAttributes = cloneAttributeMap(defaultSchema.attributes);

const upsertAttributes = (tag: string, additions: AttributeList) => {
  const current = katexAttributes[tag] ?? [];
  katexAttributes[tag] = [...current, ...additions];
};

const wildcardAttributes = new Set(katexAttributes["*"] ?? []);
wildcardAttributes.add("className");
katexAttributes["*"] = Array.from(wildcardAttributes);

upsertAttributes("div", ["className", ["className", true], "style"]);
upsertAttributes("span", ["className", ["className", true], "style"]);
upsertAttributes("math", [["xmlns", "http://www.w3.org/1998/Math/MathML"], ["display", true]]);
upsertAttributes("annotation", [["encoding", "application/x-tex"]]);


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
    katexAttributes[tag] = [];
  }
});

const katexSanitizeSchema: Schema = {
  ...defaultSchema,
  tagNames: Array.from(katexTagNames),
  attributes: katexAttributes as Schema["attributes"],
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
