import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";

// Mock next/server with minimal NextResponse/NextRequest behavior
const nextSpy = {
  nextCalls: [] as unknown[],
  redirectCalls: [] as unknown[],
};

vi.mock("next/server", () => {
  const NextResponse = {
    next: vi.fn((arg: unknown) => {
      nextSpy.nextCalls.push(arg);
      return {
        cookies: {
          set: vi.fn(),
          getAll: vi.fn(() => []),
          setAll: vi.fn(() => {}),
        },
      } as unknown as { cookies: { set: (...args: unknown[]) => void; getAll: () => unknown[]; setAll: (cs: unknown[]) => void } };
    }),
    redirect: vi.fn((url: unknown) => {
      nextSpy.redirectCalls.push(url);
      return { redirected: true, url } as { redirected: boolean; url: unknown };
    }),
  };
  return { NextResponse, NextRequest: class {}, }; // type shim
});

// Mock Supabase server client
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(),
}));

// Import SUT after mocks
import { updateSession } from "@/lib/supabase/middleware";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const ORIG_ENV = { ...process.env };

beforeEach(() => {
  vi.restoreAllMocks();
  process.env = { ...ORIG_ENV };
  (NextResponse.next as unknown as Mock).mockClear?.();
  (NextResponse.redirect as unknown as Mock).mockClear?.();
  nextSpy.nextCalls.length = 0;
  nextSpy.redirectCalls.length = 0;
});

afterEach(() => {
  process.env = { ...ORIG_ENV };
});

function makeReq(pathname: string) {
  return {
    cookies: {
      getAll: vi.fn(() => [] as unknown[]),
    },
    nextUrl: {
      pathname,
      clone() {
        return { pathname };
      },
    },
  } as unknown as NextRequest;
}

describe("middleware updateSession", () => {
  it("throws when env vars missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "k";
    await expect(updateSession(makeReq("/") as NextRequest)).rejects.toThrow(/NEXT_PUBLIC_SUPABASE_URL/);

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    await expect(updateSession(makeReq("/") as NextRequest)).rejects.toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  });

  it("wires cookie setAll onto response and does not throw", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon_key";
    // Mock client that invokes cookies.setAll during getUser()
    vi.mocked(createServerClient).mockImplementation((_u: string, _k: string, opts: unknown) => {
      const o = opts as { cookies: { setAll?: (items: Array<{ name: string; value: string; options?: Record<string, unknown> }>) => void } };
      return {
        auth: {
          getUser: vi.fn(async () => {
            // simulate Supabase writing session cookies
            o.cookies.setAll?.([
              { name: "sb-access-token", value: "tok", options: { path: "/" } },
              { name: "sb-refresh-token", value: "ref", options: { path: "/" } },
            ]);
            return { data: { user: { id: "u" } } };
          }),
        },
      } as unknown as { auth: { getUser: () => Promise<{ data: { user: { id: string } } }> } };
    });

    const res = await updateSession(makeReq("/dashboard"));
    expect(NextResponse.next).toHaveBeenCalled();
    expect(res).toBeTruthy();
  });

  it("redirects to /login when no user on private route", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon_key";
    vi.mocked(createServerClient).mockImplementation((_u: string, _k: string) => {
      return { auth: { getUser: vi.fn(async () => ({ data: { user: null } })) } } as { auth: { getUser: () => Promise<{ data: { user: null } }> } };
    });
    const resp = await updateSession(makeReq("/courses/new") as NextRequest);
    expect((resp as unknown as { redirected?: boolean }).redirected).toBe(true);
  });

  it("redirects to /dashboard when user on public route /", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon_key";
    vi.mocked(createServerClient).mockImplementation((_u: string, _k: string) => {
      return { auth: { getUser: vi.fn(async () => ({ data: { user: { id: "u" } } })) } } as { auth: { getUser: () => Promise<{ data: { user: { id: string } } }> } };
    });
    const resp = await updateSession(makeReq("/") as NextRequest);
    expect((resp as unknown as { redirected?: boolean }).redirected).toBe(true);
  });
});
