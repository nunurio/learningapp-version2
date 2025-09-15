"use client";
import * as React from "react";

export type PageContext = {
  url?: string;
  title?: string;
  selection?: string | null;
  headings?: string[] | null;
  contentSnippet?: string | null;
};

function getSelectionText(max = 800): string | null {
  try {
    const s = globalThis.getSelection?.()?.toString() ?? "";
    if (!s.trim()) return null;
    return s.slice(0, max);
  } catch {
    return null;
  }
}

function getHeadings(): string[] | null {
  try {
    const hs = Array.from(document.querySelectorAll("h1, h2, h3"))
      .slice(0, 12)
      .map((el) => (el.textContent ?? "").trim())
      .filter(Boolean);
    return hs.length ? hs : null;
  } catch {
    return null;
  }
}

export function usePageContext() {
  const [context, setContext] = React.useState<PageContext | null>(null);

  const refresh = React.useCallback(() => {
    try {
      setContext({
        url: globalThis.location?.href,
        title: globalThis.document?.title,
        selection: getSelectionText(),
        headings: getHeadings(),
        contentSnippet: null,
      });
    } catch {
      setContext(null);
    }
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  return { context, refresh } as const;
}

