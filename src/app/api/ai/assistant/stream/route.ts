import { z } from "zod";
import { NextResponse } from "next/server";
import { buildPageContextText, redactText, limitChars } from "@/lib/utils/redact";
import { parseJsonWithQuery } from "@/lib/utils/request";
import { initAgents, runner } from "@/lib/ai/agents/index";
import { Agent, user, assistant as assistantMsg, system } from "@openai/agents";
import { CHAT_INSTRUCTIONS } from "@/lib/ai/agents/chat";
import type { Readable } from "stream";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  message: z.string().min(1),
  includePage: z.boolean().optional().default(false),
  page: z
    .object({
      url: z.string().url().optional(),
      title: z.string().optional(),
      selection: z.string().nullable().optional(),
      headings: z.array(z.string()).nullable().optional(),
      contentSnippet: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  // Chat 履歴を受け取る（UI 側で user/assistant の順序を維持して送る想定）。
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1),
      })
    )
    .max(50)
    .optional(),
  threadId: z.string().uuid().optional(),
});

function shouldUseMock() {
  return (
    process.env.AI_MOCK === "1" ||
    process.env.E2E === "1" ||
    process.env.PLAYWRIGHT_TEST === "1"
  );
}

async function* mockStream(message: string, pageText: string | null) {
  const base = `ご質問ありがとうございます。` +
    (pageText ? `提供されたページ文脈を踏まえて、` : "") +
    `要点を簡潔にお答えします。`;
  const tips = pageText
    ? `
【参照した文脈（要約）】\n${limitChars(pageText, 400)}`
    : "";
  const answer = `${base}\n\n- 質問: ${limitChars(message, 200)}\n- 回答方針: 箇条書きで手短に。${tips}\n\n1. 概要: ...\n2. 重要点: ...\n3. 次に試すこと: ...`;
  const words = answer.split(/(\s+)/);
  for (const w of words) {
    yield w;
    await new Promise((r) => setTimeout(r, 16));
  }
}

export async function POST(req: Request) {
  try {
    const input = await parseJsonWithQuery(req, RequestSchema);
    const pageText = input.includePage ? buildPageContextText(input.page ?? undefined) : null;
    const userText = limitChars(redactText(input.message ?? ""), 800);
    // 直近の履歴を軽く整形（伏せ字 + 文字数制限 + 空要素除去）。
    const normalizedHistory = Array.isArray(input.history)
      ? input.history
          .filter((m) => m && typeof m.content === "string" && m.content.trim().length > 0)
          .slice(-12) // 直近のみ（トークン節約）
          .map((m) => ({ role: m.role, content: limitChars(redactText(m.content), 800) }))
      : null;
    const requestedThreadId: string | undefined = input.threadId;

    // Streaming response (Agents SDK のネイティブストリーミングに切替)
    const encoder = new TextEncoder();
    // --- Optional persistence via Supabase (if configured) ---
    let supaClient: SupabaseClient<Database> | undefined;
    let userId: string | undefined;
    try {
      const mod = await import("@/lib/supabase/server");
      supaClient = await mod.createClient();
      userId = await mod.getCurrentUserId();
    } catch {
      supaClient = undefined;
      userId = undefined;
    }
    let threadId: string | undefined;
    async function ensureThreadId(): Promise<string | undefined> {
      if (!supaClient || !userId) return undefined;
      if (requestedThreadId) return requestedThreadId;
      const title = userText.slice(0, 80) || "新しいチャット";
      try {
        const { data, error } = await supaClient
          .from("chat_threads")
          .insert({ user_id: userId, title })
          .select("id")
          .single();
        if (error) return undefined;
        return (data as { id: string } | null)?.id ?? undefined;
      } catch {
        return undefined;
      }
    }
    async function persistUserMessage(tid: string) {
      if (!supaClient || !userId || !tid) return;
      try {
        await supaClient.from("chat_messages").insert({ thread_id: tid, user_id: userId, role: "user", content: userText });
        await supaClient.from("chat_threads").update({ updated_at: new Date().toISOString() }).eq("id", tid);
      } catch {}
    }
    async function persistAssistantMessage(tid: string, text: string) {
      if (!supaClient || !userId || !tid) return;
      try {
        await supaClient.from("chat_messages").insert({ thread_id: tid, user_id: userId, role: "assistant", content: text });
        await supaClient.from("chat_threads").update({ updated_at: new Date().toISOString() }).eq("id", tid);
      } catch {}
    }

    // モック/キーなしは疑似ストリーム（可能なら Supabase に保存）
    if (shouldUseMock() || !process.env.OPENAI_API_KEY) {
      threadId = await ensureThreadId();
      if (threadId) await persistUserMessage(threadId);
      let assistantText = "";
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            for await (const chunk of mockStream(userText, pageText)) {
              assistantText += chunk;
              controller.enqueue(encoder.encode(chunk));
            }
            controller.close();
            // 完了後に確実に保存（レースを避ける）
            if (threadId && assistantText.trim()) {
              const tid = threadId; // narrow within block
              await persistAssistantMessage(tid, assistantText);
            }
          } catch (err) {
            try { controller.error(err); } catch {}
          }
        },
      });
      return new NextResponse(stream as unknown as ReadableStream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Accel-Buffering": "no",
          ...(threadId ? { "X-Thread-Id": threadId } : {}),
        },
      });
    }

    // Agents SDK のストリーミングを利用（Items化 + teeで保存）
    initAgents();

    // Ensure thread and persist the user message (best-effort)
    threadId = await ensureThreadId();
    if (threadId) await persistUserMessage(threadId);

    // Agentはシンプルに（モデルはrunner側既定）。ページ文脈はsystemで注入。
    const agent = new Agent({
      name: "Chat (site assistant)",
      instructions: CHAT_INSTRUCTIONS,
    });

    // 入力アイテム化：履歴→(system: page)→今回のuser
    const items: Array<ReturnType<typeof user> | ReturnType<typeof assistantMsg> | ReturnType<typeof system>> = [];
    if (Array.isArray(normalizedHistory)) {
      for (const m of normalizedHistory) {
        items.push(m.role === "user" ? user(m.content) : assistantMsg(m.content));
      }
    }
    if (pageText) items.push(system(pageText));
    items.push(user(userText));

    const streamed = await runner.run(agent, items, { stream: true, maxTurns: 1 });
    const textStream = streamed.toTextStream() as unknown as ReadableStream<string>;
    const [persistSide, clientSide] = (textStream as unknown as ReadableStream<string>).tee();

    // 保存側：全文を合流し、streamed.completed を待ってから保存
    (async () => {
      let assistantText = "";
      const reader = persistSide.getReader();
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (typeof value === "string") assistantText += value;
        }
      } finally {
        try { reader.releaseLock(); } catch {}
      }
      try {
        await streamed.completed; // 重要：ストリーム全完了
        if (threadId && assistantText.trim()) {
          const tid = threadId;
          await persistAssistantMessage(tid, assistantText);
        }
      } catch {}
    })();

    return new NextResponse(clientSide as unknown as ReadableStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Accel-Buffering": "no",
        ...(threadId ? { "X-Thread-Id": threadId } : {}),
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : typeof e === "string" ? e : "invalid";
    return NextResponse.json({ error: message }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
