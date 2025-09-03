import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import "fake-indexeddb/auto";
import * as React from "react";
import { setupServer } from "msw/node";
import { handlers } from "./msw";

// MSW: API モックサーバを起動
const server = setupServer(...handlers);
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Reset DOM and mocks after each test
afterEach(() => {
  cleanup();
  try { localStorage.clear(); } catch {}
  vi.useRealTimers();
});

// Provide a minimal localStorage in jsdom/node if absent
const hasLocalStorage = (obj: unknown): obj is { localStorage: Storage } => {
  return typeof obj === "object" && obj !== null && "localStorage" in obj;
};

if (!hasLocalStorage(globalThis) || !globalThis.localStorage) {
  const store = new Map<string, string>();
  
  // Define the mock storage object with proper typing
  const mockStorage: Storage = {
    getItem: (k: string) => (store.has(k) ? store.get(k) ?? null : null),
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => {
      store.clear();
    },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  };

  // Safely assign to globalThis
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
