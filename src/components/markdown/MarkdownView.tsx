"use client";
import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";

type Props = { markdown: string; className?: string };

export function MarkdownView({ markdown, className }: Props) {
  return (
    <article className={className ? className : "markdown-body"}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          rehypeSanitize,
          rehypeSlug,
          [rehypeAutolinkHeadings, { behavior: "append" }],
        ]}
      >
        {markdown || ""}
      </ReactMarkdown>
    </article>
  );
}

export default MarkdownView;

