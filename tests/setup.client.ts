import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import "fake-indexeddb/auto";
import * as React from "react";
import { setupServer } from "msw/node";
import { handlers } from "./msw";

// MSW: API モックサーバ（jsdomでもnodeサーバを利用）
const server = setupServer(...handlers);
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// 各テスト後の後始末
afterEach(() => {
  cleanup();
  try { localStorage.clear(); } catch {}
  vi.useRealTimers();
});

// jsdomでも localStorage が未定義なケースの保険
const hasLocalStorage = (obj: unknown): obj is { localStorage: Storage } => {
  return typeof obj === "object" && obj !== null && "localStorage" in obj;
};
if (!hasLocalStorage(globalThis) || !globalThis.localStorage) {
  const store = new Map<string, string>();
  const mockStorage: Storage = {
    getItem: (k) => (store.has(k) ? store.get(k) ?? null : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => { store.clear(); },
    key: (i) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: mockStorage,
    writable: true,
    configurable: true,
  });
}

// next/image を img にスタブ（テストを軽量化）
vi.mock("next/image", () => {
  return {
    default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { src: string; alt: string }) => {
      const { src, alt, ...rest } = props || ({} as React.ImgHTMLAttributes<HTMLImageElement> & { src: string; alt: string });
      return React.createElement("img", { src, alt, ...rest });
    },
  };
});
