import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { parseAssistantRequest } from "@/lib/ai/assistant/request";
import {
  createAssistantPersistence,
  createAssistantStream,
} from "@/lib/ai/assistant/stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SupabaseContext = {
  supabase?: SupabaseClient<Database>;
  userId?: string | null;
};

async function resolveSupabaseContext(): Promise<SupabaseContext> {
  try {
    const { createClient, getCurrentUserId } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const userId = await getCurrentUserId();
    return { supabase, userId };
  } catch {
    return { supabase: undefined, userId: undefined };
  }
}

export async function POST(req: Request) {
  try {
    const parsedRequest = await parseAssistantRequest(req);
    const { supabase, userId } = await resolveSupabaseContext();
    const persistence = createAssistantPersistence({ supabase, userId });

    const { stream, threadId } = await createAssistantStream({
      request: parsedRequest,
      persistence,
      supabase,
      userId,
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Accel-Buffering": "no",
        ...(threadId ? { "X-Thread-Id": threadId } : {}),
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : typeof e === "string" ? e : "invalid";
    return NextResponse.json(
      { error: message },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
}
