import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// Reset DOM and mocks after each test
afterEach(() => {
  cleanup();
  try { localStorage.clear(); } catch {}
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// Provide a minimal localStorage in jsdom/node if absent
const g = globalThis as unknown as { localStorage?: Storage };
if (!g.localStorage) {
  const store = new Map<string, string>();
  g.localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
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
  } as unknown as Storage;
}
