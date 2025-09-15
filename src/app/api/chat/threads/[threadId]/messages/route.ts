import { NextResponse } from "next/server";
import { z } from "zod";
import * as supa from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Id = z.string().uuid();

export async function GET(_req: Request, ctx: { params: Promise<{ threadId: string }> }) {
  // Alias to GET /api/chat/threads/[id]
  try {
    const client = await supa.createClient();
    const userId = await supa.getCurrentUserId();
    if (!userId) return NextResponse.json([], { headers: { "Cache-Control": "no-store" } });
    const { threadId: rawId } = await ctx.params;
    const threadId = Id.parse(rawId);
    const { data, error } = (client as any)
      .from("chat_messages")
      .select("id, role, content, created_at")
      .eq("thread_id", threadId)
      .order("created_at");
    if (error) throw error;
    const messages = (data ?? []).map((m: any) => ({ id: m.id, role: m.role, content: m.content, createdAt: m.created_at }));
    return NextResponse.json(messages, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("/api/chat/threads/[id]/messages GET error", e);
    return NextResponse.json([], { headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ threadId: string }> }) {
  // Append a message to a thread: { role: 'user'|'assistant', content: string }
  try {
    const client = await supa.createClient();
    const userId = await supa.getCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const { threadId: rawId } = await ctx.params;
    const threadId = Id.parse(rawId);
    const body = await req.text();
    const { role, content } = z
      .object({ role: z.enum(["user", "assistant"]), content: z.string().min(1) })
      .parse(body ? JSON.parse(body) : {});
    const { data, error } = (client as any)
      .from("chat_messages")
      .insert({ thread_id: threadId, user_id: userId, role, content })
      .select("id")
      .single();
    if (error) throw error;
    // Touch updated_at on thread
    await (client as any)
      .from("chat_threads")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", threadId)
      .eq("user_id", userId);
    return NextResponse.json({ id: (data as { id: string }).id }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("/api/chat/threads/[id]/messages POST error", e);
    return NextResponse.json({ error: "Failed to append message" }, { status: 500 });
  }
}
