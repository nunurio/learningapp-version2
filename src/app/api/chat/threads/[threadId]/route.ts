import { NextResponse } from "next/server";
import { z } from "zod";
import * as supa from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Id = z.string().uuid();

export async function GET(_req: Request, ctx: { params: Promise<{ threadId: string }> }) {
  // Return messages for a thread (ordered by created_at)
  try {
    const client = await supa.createClient();
    const userId = await supa.getCurrentUserId();
    if (!userId) return NextResponse.json([], { headers: { "Cache-Control": "no-store" } });
    const { threadId: rawId } = await ctx.params;
    const threadId = Id.parse(rawId);
    // Verify the thread belongs to the user
    const { data: thr, error: e0 } = client
      .from("chat_threads")
      .select("id")
      .eq("id", threadId)
      .eq("user_id", userId)
      .maybeSingle();
    if (e0) throw e0;
    if (!thr) return NextResponse.json([], { headers: { "Cache-Control": "no-store" } });
    const { data, error } = client
      .from("chat_messages")
      .select("id, role, content, created_at")
      .eq("thread_id", threadId)
      .order("created_at");
    if (error) throw error;
    const rows = (data ?? []) as { id: string; role: "user" | "assistant"; content: string; created_at: string }[];
    const messages = rows.map((m) => ({ id: m.id, role: m.role, content: m.content, createdAt: m.created_at }));
    return NextResponse.json(messages, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("/api/chat/threads/[id] GET error", e);
    return NextResponse.json([], { headers: { "Cache-Control": "no-store" } });
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ threadId: string }> }) {
  // Rename a thread: { title }
  try {
    const client = await supa.createClient();
    const userId = await supa.getCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const { threadId: rawId } = await ctx.params;
    const threadId = Id.parse(rawId);
    const body = await req.text();
    const { title } = z.object({ title: z.string().trim().min(1).max(120) }).parse(body ? JSON.parse(body) : {});
    const { error } = client
      .from("chat_threads")
      .update({ title })
      .eq("id", threadId)
      .eq("user_id", userId);
    if (error) throw error;
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("/api/chat/threads/[id] PATCH error", e);
    return NextResponse.json({ error: "Failed to rename thread" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ threadId: string }> }) {
  try {
    const client = await supa.createClient();
    const userId = await supa.getCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const { threadId: rawId } = await ctx.params;
    const threadId = Id.parse(rawId);
    // Delete messages first, then thread
    const { error: e1 } = client
      .from("chat_messages")
      .delete()
      .eq("thread_id", threadId);
    if (e1) throw e1;
    const { error: e2 } = client
      .from("chat_threads")
      .delete()
      .eq("id", threadId)
      .eq("user_id", userId);
    if (e2) throw e2;
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("/api/chat/threads/[id] DELETE error", e);
    return NextResponse.json({ error: "Failed to delete thread" }, { status: 500 });
  }
}
