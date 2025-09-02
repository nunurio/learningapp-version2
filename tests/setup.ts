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
