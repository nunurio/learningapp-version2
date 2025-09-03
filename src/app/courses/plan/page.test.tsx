/* @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import * as React from "react";

// Router をモック
vi.mock("next/navigation", () => {
  return { useRouter: () => ({ replace: vi.fn() }) };
});

// toast をモックしてアクションを取り出す
const toastSpy = vi.fn();
vi.mock("@/components/ui/toaster", () => {
  const listeners = new Set<() => void>();
  const history: any[] = [];
  return {
    toast: (...args: any[]) => {
      toastSpy(...args);
      const t = args?.[0] ?? {};
      history.push({ id: String(history.length + 1), createdAt: Date.now(), state: "shown", ...t });
      listeners.forEach((fn) => fn());
    },
    getToastHistory: () => [...history],
    subscribeToastHistory: (cb: () => void) => { listeners.add(cb); return () => listeners.delete(cb); },
  };
});

// client-api をモック（テストごとに実装差し替え）
vi.mock("@/lib/client-api", () => ({
  commitCoursePlan: vi.fn(async (_draftId: string) => ({ courseId: "COURSE-1" })),
  saveDraft: vi.fn(async () => ({ id: "D1" })),
  deleteCourse: vi.fn(async () => undefined),
}));

// Header を最小スタブ（ナビの副作用や余計なボタンを避ける）
vi.mock("@/components/ui/header", () => ({ Header: () => <div data-testid="header" /> }));

// SUT を遅延 import（mocks 反映）
async function loadPage() {
  const mod = await import("./page");
  return mod.default;
}

describe("app/courses/plan/page", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("テーマ必須。生成開始でボタンが無効化→完了でプレビュー開く（短縮スケール）", async () => {
    // 進行タイマーを短縮（0.1%）
    process.env.NEXT_PUBLIC_TIMELINE_SCALE = "0.001";
    const Page = await loadPage();
    render(<Page />);
    // 入力→生成開始
    fireEvent.change(screen.getByTestId("theme-input"), { target: { value: "機械学習" } });
    fireEvent.click(screen.getByTestId("generate-btn"));
    expect(screen.getByTestId("generate-btn")).toBeDisabled();

    // fetch 解決 → 下書き保存 → プレビューオープン
    await screen.findByTestId("commit-btn");
  }, 5000);

  it("プレビュー編集→saveDraft('outline')→commitCoursePlan→toastのactionでdeleteCourse", async () => {
    process.env.NEXT_PUBLIC_TIMELINE_SCALE = "0.001";
    
    const api = await import("@/lib/client-api");
    const Page = await loadPage();
    render(<Page />);
    // 生成してプレビューを開く
    fireEvent.change(screen.getByTestId("theme-input"), { target: { value: "テスト" } });
    fireEvent.click(screen.getByTestId("generate-btn"));
    // プレビューが開くのを待つ
    await screen.findByTestId("commit-btn");

    // コースタイトルを軽く編集して保存
    const input = screen.getByDisplayValue("MSW");
    fireEvent.change(input, { target: { value: "T2" } });
    await screen.findByDisplayValue("T2");
    fireEvent.click(screen.getByTestId("commit-btn"));

    // saveDraft → commitCoursePlan が呼ばれ、router.replace が実行される
    expect(api.saveDraft).toHaveBeenCalled();
    const draftArg = (api.saveDraft as any).mock.calls[0]?.[1];
    expect(draftArg?.course).toBeTruthy();
    await waitFor(() => expect(api.commitCoursePlan).toHaveBeenCalledWith("D1"));

    // toast に action が渡される。action を呼ぶと deleteCourse が呼ばれ得る
    const toastArg = toastSpy.mock.calls[0]?.[0] ?? {};
    expect(toastArg?.onAction).toBeTypeOf("function");
    await toastArg.onAction?.();
    expect(api.deleteCourse).toHaveBeenCalledWith("COURSE-1");
  }, 5000);
});
