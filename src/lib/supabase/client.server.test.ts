import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/client";
import { createBrowserClient } from "@supabase/ssr";

const ORIG_ENV = { ...process.env };

beforeEach(() => {
  vi.restoreAllMocks();
  process.env = { ...ORIG_ENV };
});

afterEach(() => {
  process.env = { ...ORIG_ENV };
});

describe("supabase/client createClient (browser)", () => {
  it("throws with clear messages when env vars are missing", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "k";
    expect(() => createClient()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    expect(() => createClient()).toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  });

  it("creates browser client with url and key", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon_key";
    vi.mocked(createBrowserClient as any).mockReturnValue({ ok: true });
    const c = createClient();
    expect(createBrowserClient).toHaveBeenCalledWith("https://example.supabase.co", "anon_key");
    expect(c).toEqual({ ok: true });
  });
});

