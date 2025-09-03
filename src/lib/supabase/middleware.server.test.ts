import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock next/server with minimal NextResponse/NextRequest behavior
const nextSpy = {
  nextCalls: [] as any[],
  redirectCalls: [] as any[],
};

vi.mock("next/server", () => {
  const NextResponse = {
    next: vi.fn((arg: any) => {
      nextSpy.nextCalls.push(arg);
      return {
        cookies: {
          set: vi.fn(),
          getAll: vi.fn(() => []),
          setAll: vi.fn(() => {}),
        },
      } as any;
    }),
    redirect: vi.fn((url: any) => {
      nextSpy.redirectCalls.push(url);
      return { redirected: true, url } as any;
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
import { NextResponse } from "next/server";

const ORIG_ENV = { ...process.env };

beforeEach(() => {
  vi.restoreAllMocks();
  process.env = { ...ORIG_ENV };
  (NextResponse.next as any).mockClear?.();
  (NextResponse.redirect as any).mockClear?.();
  nextSpy.nextCalls.length = 0;
  nextSpy.redirectCalls.length = 0;
});

afterEach(() => {
  process.env = { ...ORIG_ENV };
});

function makeReq(pathname: string) {
  return {
    cookies: {
      getAll: vi.fn(() => []),
    },
    nextUrl: {
      pathname,
      clone() {
        return {
          pathname,
        } as any;
      },
    },
  } as any;
}

describe("middleware updateSession", () => {
  it("throws when env vars missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "k";
    await expect(updateSession(makeReq("/"))).rejects.toThrow(/NEXT_PUBLIC_SUPABASE_URL/);

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    await expect(updateSession(makeReq("/"))).rejects.toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  });

  it("wires cookie setAll onto response and does not throw", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon_key";
    // Mock client that invokes cookies.setAll during getUser()
    vi.mocked(createServerClient as any).mockImplementation((_u: string, _k: string, opts: any) => {
      return {
        auth: {
          getUser: vi.fn(async () => {
            // simulate Supabase writing session cookies
            opts.cookies.setAll?.([
              { name: "sb-access-token", value: "tok", options: { path: "/" } },
              { name: "sb-refresh-token", value: "ref", options: { path: "/" } },
            ]);
            return { data: { user: { id: "u" } } };
          }),
        },
      } as any;
    });

    const res = await updateSession(makeReq("/dashboard"));
    expect(NextResponse.next).toHaveBeenCalled();
    expect(res).toBeTruthy();
  });

  it("redirects to /login when no user on private route", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon_key";
    vi.mocked(createServerClient as any).mockImplementation((_u: string, _k: string) => {
      return { auth: { getUser: vi.fn(async () => ({ data: { user: null } })) } } as any;
    });
    const resp = await updateSession(makeReq("/courses/new"));
    expect((resp as any).redirected).toBe(true);
  });

  it("redirects to /dashboard when user on public route /", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon_key";
    vi.mocked(createServerClient as any).mockImplementation((_u: string, _k: string) => {
      return { auth: { getUser: vi.fn(async () => ({ data: { user: { id: "u" } } })) } } as any;
    });
    const resp = await updateSession(makeReq("/"));
    expect((resp as any).redirected).toBe(true);
  });
});

