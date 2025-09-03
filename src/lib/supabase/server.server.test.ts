import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock external deps before importing SUT
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(),
}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { createClient, getCurrentUserId } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";
import { cookies as cookiesFn } from "next/headers";

const ORIG_ENV = { ...process.env };

beforeEach(() => {
  vi.restoreAllMocks();
  process.env = { ...ORIG_ENV };
});

afterEach(() => {
  process.env = { ...ORIG_ENV };
});

describe("supabase/server createClient", () => {
  it("throws with clear messages when env vars are missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "key";
    await expect(createClient()).rejects.toThrow("NEXT_PUBLIC_SUPABASE_URL");

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    await expect(createClient()).rejects.toThrow("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  });

  it("wires Next cookies() into Supabase client options (getAll/setAll)", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon_key";

    const store = {
      getAll: vi.fn(() => [{ name: "a", value: "1" }]),
      set: vi.fn(),
    } as any;
    vi.mocked(cookiesFn).mockResolvedValue(store);

    let capturedOpts: any;
    vi.mocked(createServerClient as any).mockImplementation((url: string, key: string, opts: any) => {
      expect(url).toBe("https://example.supabase.co");
      expect(key).toBe("anon_key");
      capturedOpts = opts;
      return { auth: { getUser: vi.fn(async () => ({ data: { user: { id: "u-1" } } })) } } as any;
    });

    await createClient();

    // getAll proxies to cookie store
    const out = capturedOpts.cookies.getAll();
    expect(out).toEqual([{ name: "a", value: "1" }]);
    expect(store.getAll).toHaveBeenCalledTimes(1);

    // setAll calls cookieStore.set for each cookie, and swallows errors
    capturedOpts.cookies.setAll([
      { name: "sb-access-token", value: "tok", options: { path: "/" } },
      { name: "sb-refresh-token", value: "ref", options: { path: "/" } },
    ]);
    expect(store.set).toHaveBeenCalledTimes(2);

    // When set() throws, setAll must not rethrow
    store.set.mockImplementationOnce(() => { throw new Error("readonly"); });
    expect(() =>
      capturedOpts.cookies.setAll([
        { name: "x", value: "y", options: { path: "/" } },
      ])
    ).not.toThrow();
  });
});

describe("getCurrentUserId", () => {
  it("returns user id when session exists", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon_key";
    vi.mocked(cookiesFn).mockResolvedValue({ getAll: vi.fn(() => []), set: vi.fn() } as any);
    vi.mocked(createServerClient as any).mockImplementation((_u: string, _k: string) => {
      return { auth: { getUser: vi.fn(async () => ({ data: { user: { id: "user-123" } } })) } } as any;
    });
    const uid = await getCurrentUserId();
    expect(uid).toBe("user-123");
  });

  it("returns undefined when no user", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon_key";
    vi.mocked(cookiesFn).mockResolvedValue({ getAll: vi.fn(() => []), set: vi.fn() } as any);
    vi.mocked(createServerClient as any).mockImplementation((_u: string, _k: string) => {
      return { auth: { getUser: vi.fn(async () => ({ data: { user: null } })) } } as any;
    });
    const uid = await getCurrentUserId();
    expect(uid).toBeUndefined();
  });
});

