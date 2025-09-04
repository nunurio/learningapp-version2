import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import * as React from "react";

// Virtualizer を簡易スタブ化（要素高さに依存せず全行を描画）
vi.mock("@tanstack/react-virtual", () => {
  type Options = { count: number; estimateSize?: (index: number) => number };
  type Item = { index: number; key: number; start: number; size: number };
  return {
    useVirtualizer: (opts: Options) => {
      const { count, estimateSize } = opts;
      const size = (i: number) => (estimateSize ? estimateSize(i) : 28);
      return {
        getVirtualItems: (): Item[] =>
          Array.from({ length: count }, (_, i) => ({ index: i, key: i, start: i * size(i), size: size(i) })),
        getTotalSize: () => count * size(0),
      };
    },
  };
});

import { NavTree } from "@/components/workspace/NavTree";

const nowISO = new Date().toISOString();

vi.mock("@/lib/client-api", () => {
  return {
    snapshot: vi.fn(async () => ({
      courses: [{ id: "course1", title: "C1", status: "draft", createdAt: nowISO, updatedAt: nowISO }],
      lessons: [{ id: "lesson1", courseId: "course1", title: "L1", orderIndex: 0, createdAt: nowISO }],
      cards: [
        {
          id: "cardL4",
          lessonId: "lesson1",
          cardType: "text",
          title: null,
          tags: [],
          content: { body: "Hello" },
          orderIndex: 0,
          createdAt: nowISO,
        },
      ],
      progress: [{ cardId: "cardL4", completed: true, completedAt: nowISO, answer: { level: 4 } }],
      flags: [],
      notes: [],
    })),
    listFlaggedByCourse: vi.fn(async () => []),
  };
});

describe("NavTree - リングは理解度を%表示", () => {
  it("level=4 のカードが 80% で表示される", async () => {
    render(<NavTree courseId={"course1"} selectedId={undefined} onSelect={() => {}} />);
    // レッスンを展開
    const lessonRow = await screen.findByText("L1");
    // 同じ treeitem 行内の「展開」ボタンを押す
    const rowEl = lessonRow.closest('[role="treeitem"]') ?? lessonRow.parentElement;
    expect(rowEl).not.toBeNull();
    const toggle = within(rowEl as Element).getByRole("button", { name: /展開|折りたたむ/ });
    toggle.click();
    // カード行（"Hello" の断片 or テキスト）を待ち、そこに 80% のリングがあること
    const cardRow = await screen.findByText(/Hello|テキスト/);
    const host = cardRow.closest('[role="treeitem"]') ?? cardRow.parentElement;
    expect(host).not.toBeNull();
    const img = within(host as Element).getByRole("img", { name: /進捗\s*80%/ });
    expect(img).toBeInTheDocument();
  });
});
