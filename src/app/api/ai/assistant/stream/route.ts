import { z } from "zod";
import { NextResponse } from "next/server";
import { buildPageContextText, redactText, limitChars } from "@/lib/utils/redact";
import { parseJsonWithQuery } from "@/lib/utils/request";
import { initAgents, runner } from "@/lib/ai/agents/index";
import { user, assistant as assistantMsg, system } from "@openai/agents";
import { createChatAgent } from "@/lib/ai/agents/chat";
import type { Readable } from "stream";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import {
  ActiveRefSchema,
  type ContextBundle,
  getContextBundle,
} from "@/lib/ai/tools/context-tools";

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
      activeRef: ActiveRefSchema.optional(),
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
  activeRef: ActiveRefSchema.optional(),
});

function sanitizeText(value: unknown, max = 400): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return limitChars(redactText(trimmed), max);
}

function indentBlock(value: string): string {
  return value
    .split(/\r?\n/)
    .map((line) => (line.length > 0 ? `  ${line}` : ""))
    .join("\n");
}

function formatCardContentForPrompt(card: ContextBundle["card"] | undefined): string | null {
  if (!card?.content) return null;
  const content = card.content as Record<string, unknown>;

  switch (card.cardType) {
    case "text": {
      return sanitizeText(content.body, 1200);
    }
    case "quiz": {
      const parts: string[] = [];
      const question = sanitizeText(content.question, 600);
      if (question) parts.push(`問題: ${question}`);

      if (Array.isArray(content.options)) {
        const options = (content.options as unknown[]).reduce<string[]>((acc, opt, idx) => {
          if (typeof opt !== "string") return acc;
          const sanitized = sanitizeText(opt, 200);
          if (!sanitized) return acc;
          acc.push(`${idx + 1}. ${sanitized}`);
          return acc;
        }, []);
        if (options.length > 0) {
          parts.push(`選択肢:\n${options.map((opt) => `  ${opt}`).join("\n")}`);
        }
      }

      const answerIndexRaw = content.answerIndex;
      if (typeof answerIndexRaw === "number") {
        parts.push(`正解: 選択肢 ${answerIndexRaw + 1}`);
      }
      const explanation = sanitizeText(content.explanation, 400);
      if (explanation) parts.push(`解説: ${explanation}`);
      return parts.length ? parts.join("\n") : null;
    }
    case "fill-blank": {
      const parts: string[] = [];
      const text = sanitizeText(content.text, 800);
      if (text) parts.push(`本文: ${text}`);
      const answersRaw = content.answers;
      if (answersRaw && typeof answersRaw === "object" && !Array.isArray(answersRaw)) {
        const entries = Object.entries(answersRaw as Record<string, unknown>).reduce<string[]>(
          (acc, [key, value]) => {
            if (typeof value !== "string") return acc;
            const sanitized = sanitizeText(value, 200);
            if (!sanitized) return acc;
            acc.push(`${key}: ${sanitized}`);
            return acc;
          },
          []
        );
        if (entries.length > 0) {
          parts.push(`解答:\n${entries.map((entry) => `  ${entry}`).join("\n")}`);
        }
      }
      if (content.caseSensitive === true) {
        parts.push("※ 大文字小文字を区別します");
      }
      return parts.length ? parts.join("\n") : null;
    }
    default: {
      try {
        return limitChars(redactText(JSON.stringify(content)), 800);
      } catch {
        return null;
      }
    }
  }
}

function buildActiveCardContextText(bundle: ContextBundle): string | null {
  if (!bundle.card && !bundle.lesson && !bundle.course) return null;

  const lines: string[] = ["【現在開いているカード情報】"];

  if (bundle.course) {
    const title = sanitizeText(bundle.course.title, 160) ?? "(タイトル未設定)";
    lines.push(`- コース: ${title} (ID: ${bundle.course.id})`);
  } else if (bundle.ref?.courseId) {
    lines.push(`- コースID: ${bundle.ref.courseId}`);
  }

  if (bundle.lesson) {
    const title = sanitizeText(bundle.lesson.title, 160) ?? "(タイトル未設定)";
    lines.push(`- レッスン: ${title} (ID: ${bundle.lesson.id})`);
  } else if (bundle.ref?.lessonId) {
    lines.push(`- レッスンID: ${bundle.ref.lessonId}`);
  }

  if (bundle.card) {
    const title = sanitizeText(bundle.card.title, 200) ?? "(タイトル未設定)";
    lines.push(`- カードタイトル: ${title} (ID: ${bundle.card.id})`);
    lines.push(`- カード種別: ${bundle.card.cardType}`);
  } else if (bundle.ref?.cardId) {
    lines.push(`- カードID: ${bundle.ref.cardId}`);
  }

  const body = formatCardContentForPrompt(bundle.card);
  if (body) {
    lines.push(`- カード本文:\n${indentBlock(body)}`);
  }

  return lines.join("\n");
}

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
    const rawActiveRef = input.activeRef ?? input.page?.activeRef ?? undefined;

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

    const historyLength = Array.isArray(normalizedHistory) ? normalizedHistory.length : 0;
    let agentUserText = userText;
    if (historyLength === 0 && supaClient && rawActiveRef) {
      try {
        const activeRef = ActiveRefSchema.parse(rawActiveRef);
        const bundle = await getContextBundle({
          supabase: supaClient,
          ref: activeRef,
          userId,
          include: { neighbors: false, progress: false, flags: false, notes: false, maxBody: 1600 },
        });
        const contextText = buildActiveCardContextText(bundle);
        if (contextText) {
          agentUserText = `${contextText}\n\n${userText}`;
        }
      } catch (err) {
        console.error("[assistant-stream] Failed to enrich user message with card context", err);
      }
    }

    // モック/キーなしは疑似ストリーム（可能なら Supabase に保存）
    if (shouldUseMock() || !process.env.OPENAI_API_KEY) {
      threadId = await ensureThreadId();
      if (threadId) await persistUserMessage(threadId);
      let assistantText = "";
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            for await (const chunk of mockStream(agentUserText, pageText)) {
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
    const agent = createChatAgent();

    // 入力アイテム化：履歴→(system: page)→今回のuser
    const items: Array<ReturnType<typeof user> | ReturnType<typeof assistantMsg> | ReturnType<typeof system>> = [];
    if (Array.isArray(normalizedHistory)) {
      for (const m of normalizedHistory) {
        items.push(m.role === "user" ? user(m.content) : assistantMsg(m.content));
      }
    }
    if (pageText) items.push(system(pageText));
    items.push(user(agentUserText));

    const streamed = await runner.run(agent, items, {
      stream: true,
      maxTurns: 2,
    });
    const textStream = streamed.toTextStream() as unknown as ReadableStream<string>;
    const [persistSide, clientSide] = (textStream as unknown as ReadableStream<string>).tee();
    const encodedClientStream = new ReadableStream<Uint8Array>({
      start(controller) {
        const reader = clientSide.getReader();
        (async () => {
          try {
            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              if (typeof value === "string") {
                if (value.length > 0) controller.enqueue(encoder.encode(value));
              } else if (value != null) {
                const text = String(value);
                if (text.length > 0) controller.enqueue(encoder.encode(text));
              }
            }
            controller.close();
          } catch (err) {
            try { controller.error(err); } catch {}
          } finally {
            try { reader.releaseLock(); } catch {}
          }
        })();
      },
    });

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

    return new NextResponse(encodedClientStream as unknown as ReadableStream, {
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
