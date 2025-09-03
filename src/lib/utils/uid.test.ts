import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { uid } from "@/lib/utils/uid";

// UUID v4-ish (format check only; version/variant via regex)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FALLBACK_RE = /^\d{13}_[a-z0-9]+$/i;

const originalCrypto = globalThis.crypto;

beforeEach(() => {
  // Ensure a clean slate for spies/replacements
  vi.restoreAllMocks();
  if (originalCrypto) {
    Object.defineProperty(globalThis, "crypto", {
      value: originalCrypto,
      configurable: true,
    });
  }
});

afterEach(() => {
  // Always restore the original crypto object
  if (originalCrypto) {
    Object.defineProperty(globalThis, "crypto", {
      value: originalCrypto,
      configurable: true,
    });
  }
});

describe("uid", () => {
  it("crypto.randomUUID が存在するときは UUID 形式を返す", () => {
    // If the host provides randomUUID, assert UID format (and prefer spy to ensure path)
    if (globalThis.crypto && "randomUUID" in globalThis.crypto) {
      const stub = "123e4567-e89b-42d3-a456-426614174000"; // valid UUID format
      const spy = vi
        .spyOn(globalThis.crypto, "randomUUID")
        .mockReturnValue(stub as `${string}-${string}-${string}-${string}-${string}`);
      const id = uid();
      expect(id).toBe(stub);
      expect(id).toMatch(UUID_RE);
      expect(spy).toHaveBeenCalledTimes(1);
    } else {
      // Provide a minimal crypto with randomUUID for this test
      Object.defineProperty(globalThis, "crypto", {
        value: {
          randomUUID: () => "123e4567-e89b-42d3-a456-426614174000",
        },
        configurable: true,
      });
      const id = uid();
      expect(id).toMatch(UUID_RE);
    }
  });

  it("randomUUID が未定義なら Date.now()_rand 形式にフォールバック", () => {
    // Replace crypto with object lacking randomUUID
    Object.defineProperty(globalThis, "crypto", {
      value: { /* intentionally no randomUUID */ },
      configurable: true,
    });
    const id = uid();
    expect(id).toMatch(FALLBACK_RE);
    const [ts] = id.split("_");
    expect(ts).toHaveLength(13);
  });

  it("randomUUID が例外を投げてもフォールバックする", () => {
    // Ensure we have a crypto object first
    // 例外を投げるrandomUUIDを持つcryptoに差し替える
    Object.defineProperty(globalThis, "crypto", {
      value: {
        randomUUID: () => {
          throw new Error("boom");
        },
      },
      configurable: true,
    });

    const id = uid();
    expect(id).toMatch(FALLBACK_RE);
  });

  it("連続呼び出ししても高確率で一意 (randomUUID 経路)", () => {
    // If randomUUID exists, use it; otherwise provide a simple stub
    if (!globalThis.crypto || !("randomUUID" in globalThis.crypto)) {
      Object.defineProperty(globalThis, "crypto", {
        value: {
          randomUUID: () => cryptoLikeUUID(),
        },
        configurable: true,
      });
    }
    const N = 200;
    const set = new Set<string>();
    for (let i = 0; i < N; i++) set.add(uid());
    expect(set.size).toBe(N);
  });

  it("連続呼び出ししても高確率で一意 (フォールバック経路)", () => {
    // Force fallback by removing randomUUID
    Object.defineProperty(globalThis, "crypto", {
      value: { /* no randomUUID */ },
      configurable: true,
    });
    const N = 200;
    const set = new Set<string>();
    for (let i = 0; i < N; i++) set.add(uid());
    expect(set.size).toBe(N);
  });
});

// Helper: generate a UUID-like string when needed for stubbing
function cryptoLikeUUID(): string {
  // Simple, sufficient for uniqueness tests (not cryptographically secure)
  const s = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  const v = ((Math.floor(Math.random() * 4) + 1) as 1 | 2 | 3 | 4).toString(16);
  const vv = ((8 + Math.floor(Math.random() * 4)) as 8 | 9 | 10 | 11).toString(16);
  return `${s(8)}-${s(4)}-${v}${s(3)}-${vv}${s(3)}-${s(12)}`;
}
