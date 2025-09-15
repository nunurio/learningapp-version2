import { z } from "zod";
import { NextResponse } from "next/server";
import { buildPageContextText, redactText, limitChars } from "@/lib/utils/redact";
import { parseJsonWithQuery } from "@/lib/utils/request";
import { initAgents } from "@/lib/ai/agents/index";
import { Runner, Agent } from "@openai/agents";
import { CHAT_INSTRUCTIONS } from "@/lib/ai/agents/chat";
import type { Readable } from "stream";

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
  // Chat 履歴を受け取る（Agents SDK へそのまま渡す）。
  // UI 側で user/assistant の順序を維持して送る想定。
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
    const history = Array.isArray(input.history)
      ? input.history
          .filter((m) => m && typeof m.content === "string" && m.content.trim().length > 0)
          .slice(-12) // 直近のみ（トークン節約）
          .map((m) => ({ role: m.role, content: limitChars(redactText(m.content), 800) }))
      : null;
    const requestedThreadId: string | undefined = input.threadId;

    // Streaming response (Agents SDK のネイティブストリーミングに切替)
    const encoder = new TextEncoder();
    // --- Optional persistence via Supabase (if configured) ---
    let supaClient: any | undefined;
    let userId: string | undefined;
    try {
      const mod = await import("@/lib/supabase/server");
      supaClient = await (mod as any).createClient();
      userId = await (mod as any).getCurrentUserId();
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
          } catch (err) {
            try { controller.error(err); } catch {}
          }
        },
      });
      // 後追いで保存
      (async () => { if (threadId && assistantText) await persistAssistantMessage(threadId!, assistantText); })();
      return new NextResponse(stream as unknown as ReadableStream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Accel-Buffering": "no",
          ...(threadId ? { "X-Thread-Id": threadId } : {}),
        },
      });
    }

    // Agents SDK のストリーミングを利用
    initAgents();
    const payload = {
      task: "Answer the user question as helpful assistant.",
      parameters: {
        message: userText,
        pageContext: pageText ?? null,
        history,
      },
    } as const;

    // stream: true でイベントストリームを受け取り、テキストに整形
    // チャット専用 Runner（reasoning.effort=minimal を明示）。他エージェントには影響しない。
    const chatModel = ((): string => {
      const m = process.env.OPENAI_MODEL?.trim();
      if (m && /^gpt-5(-|$)/.test(m)) return m; // GPT‑5 系のみ許可
      return "gpt-5"; // 強制的に GPT‑5 に固定（minimal 対応）
    })();

    const chatRunner = new Runner({
      model: chatModel,
      // Runner 側は重複設定を持たせず、Agent 側をソースオブトゥルースにする
      workflowName: "Chat assistant",
      traceIncludeSensitiveData: false,
    });
    // Agent 側にも同一の modelSettings を明示して、確実に API へ伝搬させる
    const agent = new Agent({
      name: "Chat (minimal)",
      instructions: CHAT_INSTRUCTIONS,
      model: chatModel,
      modelSettings: {
        parallelToolCalls: false,
        reasoning: { effort: "minimal" },
        text: { verbosity: "low" },
        toolChoice: "none",
        // 念のため providerData 経由でも同値を伝搬（SDK経路での取りこぼし対策）
        providerData: {
          reasoning: { effort: "minimal" },
          text: { verbosity: "low" },
        },
      } as unknown as {},
    });

    // Ensure thread and persist the user message (best-effort)
    threadId = await ensureThreadId();
    if (threadId) await persistUserMessage(threadId);

    const result = await chatRunner.run(agent, JSON.stringify(payload), { maxTurns: 1, stream: true });
    // Web ReadableStream<string> を取得し、そのまま UTF-8 に変換して返す
    const textWebStream = result.toTextStream() as unknown as ReadableStream<string>;
    // pipeThrough が型で認識されない環境向けに、手動で変換ストリームを作成
    let assistantText = "";
    const webStream = new ReadableStream<Uint8Array>({
      start(controller) {
        const reader = textWebStream.getReader();
        (async () => {
          try {
            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              if (typeof value === "string" && value.length) {
                assistantText += value;
                controller.enqueue(encoder.encode(value));
              }
            }
            controller.close();
          } catch (err) {
            try { controller.error(err as unknown); } catch {}
          } finally {
            try { reader.releaseLock(); } catch {}
          }
        })();
      },
    });

    // Persist when finished
    (async () => { if (threadId && assistantText) await persistAssistantMessage(threadId!, assistantText); })();

    return new NextResponse(webStream as unknown as ReadableStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Accel-Buffering": "no",
        "X-Agents-Model": chatModel,
        "X-Reasoning-Effort-Requested": "minimal",
        ...(threadId ? { "X-Thread-Id": threadId } : {}),
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : typeof e === "string" ? e : "invalid";
    return NextResponse.json({ error: message }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
