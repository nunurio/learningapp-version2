import { NextResponse } from "next/server";
import { z } from "zod";
import * as supa from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  // List chat threads for current user
  try {
    const client = await supa.createClient();
    const userId = await supa.getCurrentUserId();
    if (!userId) return NextResponse.json([], { headers: { "Cache-Control": "no-store" } });
    const { data, error } = (client as any)
      .from("chat_threads")
      .select("id, title, created_at, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    const rows = (data ?? []) as { id: string; title: string; created_at: string; updated_at: string }[];
    const threads = rows.map((r) => ({ id: r.id, title: r.title, createdAt: r.created_at, updatedAt: r.updated_at }));
    return NextResponse.json(threads, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    // If tables are missing or env is not configured, degrade gracefully
    console.error("/api/chat/threads GET error", e);
    return NextResponse.json([], { headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(req: Request) {
  // Create a new thread; body: { title?: string }
  try {
    const client = await supa.createClient();
    const userId = await supa.getCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const body = await req.text();
    const parsed = z
      .object({ title: z.string().trim().min(1).max(120).optional() })
      .safeParse(body ? JSON.parse(body) : {});
    const title = parsed.success && parsed.data.title ? parsed.data.title : "新しいチャット";
    const { data, error } = (client as any)
      .from("chat_threads")
      .insert({ user_id: userId, title })
      .select("id")
      .single();
    if (error) throw error;
    return NextResponse.json({ id: (data as { id: string }).id }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("/api/chat/threads POST error", e);
    return NextResponse.json({ error: "Failed to create thread" }, { status: 500 });
  }
}

