import type { Agent } from "@openai/agents";
import type { SupabaseClient } from "@supabase/supabase-js";
import { limitChars } from "@/lib/utils/redact";
import { runner, initAgents } from "@/lib/ai/agents/index";
import { getContextBundle } from "@/lib/ai/tools/context-tools";
import {
  buildChatItems,
  createChatAgent,
} from "@/lib/ai/agents/chat";
import type { AssistantRequestPayload } from "@/lib/ai/assistant/request";
import { buildActiveCardContextText } from "@/lib/ai/assistant/context";
import type { Database } from "@/lib/database.types";

type ContextSupabase = Parameters<typeof getContextBundle>[0]["supabase"];

export type AssistantPersistence = {
  ensureThreadId: (requestedThreadId: string | undefined, userText: string) => Promise<string | undefined>;
  persistUserMessage: (threadId: string, content: string) => Promise<void>;
  persistAssistantMessage: (threadId: string, content: string) => Promise<void>;
};

export function createAssistantPersistence(options: {
  supabase?: ContextSupabase;
  userId?: string | null;
}): AssistantPersistence {
  const { supabase, userId } = options;

  if (!supabase || !userId) {
    return {
      ensureThreadId: async (requestedThreadId) => requestedThreadId,
      persistUserMessage: async () => {},
      persistAssistantMessage: async () => {},
    };
  }

  return {
    async ensureThreadId(requestedThreadId, userText) {
      if (requestedThreadId) return requestedThreadId;
      const title = userText.slice(0, 80) || "新しいチャット";
      try {
        const response = await supabase
          .from("chat_threads")
          .insert({ user_id: userId, title })
          .select("id")
          .single();
        if (response.error) return undefined;
        const row = response.data as { id: string } | null;
        return row?.id ?? undefined;
      } catch {
        return undefined;
      }
    },
    async persistUserMessage(threadId, content) {
      if (!threadId) return;
      try {
        await supabase.from("chat_messages").insert({ thread_id: threadId, user_id: userId, role: "user", content });
        await supabase.from("chat_threads").update({ updated_at: new Date().toISOString() }).eq("id", threadId);
      } catch {}
    },
    async persistAssistantMessage(threadId, content) {
      if (!threadId) return;
      try {
        await supabase.from("chat_messages").insert({ thread_id: threadId, user_id: userId, role: "assistant", content });
        await supabase.from("chat_threads").update({ updated_at: new Date().toISOString() }).eq("id", threadId);
      } catch {}
    },
  };
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
    ? `\n【参照した文脈（要約）】\n${limitChars(pageText, 400)}`
    : "";
  const answer = `${base}\n\n- 質問: ${limitChars(message, 200)}\n- 回答方針: 箇条書きで手短に。${tips}\n\n1. 概要: ...\n2. 重要点: ...\n3. 次に試すこと: ...`;
  const words = answer.split(/(\s+)/);
  for (const w of words) {
    yield w;
    await new Promise((resolve) => setTimeout(resolve, 16));
  }
}

export type CreateAssistantStreamParams = {
  request: AssistantRequestPayload;
  persistence: AssistantPersistence;
  supabase?: ContextSupabase;
  userId?: string | null;
  agentFactory?: () => Agent<unknown>;
};

export type AssistantStreamResult = {
  stream: ReadableStream<Uint8Array>;
  threadId?: string;
};

export async function createAssistantStream(
  params: CreateAssistantStreamParams
): Promise<AssistantStreamResult> {
  const {
    request,
    persistence,
    supabase,
    userId,
    agentFactory = createChatAgent as () => Agent<unknown>,
  } = params;

  const encoder = new TextEncoder();
  const historyLength = request.history.length;

  let threadId = await persistence.ensureThreadId(request.requestedThreadId, request.userText);
  if (threadId) await persistence.persistUserMessage(threadId, request.userText);

  let agentUserText = request.userText;
  if (historyLength === 0 && supabase && userId && request.activeRef) {
    try {
      const bundle = await getContextBundle({
        supabase,
        ref: request.activeRef,
        userId,
        include: { neighbors: false, progress: false, flags: false, notes: false, maxBody: 1600 },
      });
      const contextText = buildActiveCardContextText(bundle);
      if (contextText) {
        agentUserText = `${contextText}\n\n${agentUserText}`;
      }
    } catch (err) {
      console.error("[assistant-stream] Failed to enrich user message with card context", err);
    }
  }

  if (shouldUseMock() || !process.env.OPENAI_API_KEY) {
    let assistantText = "";
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of mockStream(agentUserText, request.pageText)) {
            assistantText += chunk;
            controller.enqueue(encoder.encode(chunk));
          }
          controller.close();
          if (threadId && assistantText.trim()) {
            const tid = threadId;
            await persistence.persistAssistantMessage(tid, assistantText);
          }
        } catch (err) {
          try { controller.error(err); } catch {}
        }
      },
    });
    return {
      stream: stream as unknown as ReadableStream<Uint8Array>,
      threadId: threadId ?? undefined,
    };
  }

  initAgents();
  const agent = agentFactory();

  const items = buildChatItems({
    history: request.history,
    historyLimit: historyLength || undefined,
    message: agentUserText,
    pageText: request.pageText,
  });

  const streamed = await runner.run(agent, items, {
    stream: true,
    maxTurns: 2,
  });

  const textStream = streamed.toTextStream() as unknown as ReadableStream<string>;
  const [persistSide, clientSide] = textStream.tee();
  const encodedClientStream = new ReadableStream<Uint8Array>({
    start(controller) {
      const reader = clientSide.getReader();
      (async () => {
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (typeof value === "string" && value.length > 0) {
              controller.enqueue(encoder.encode(value));
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
      await streamed.completed;
      if (threadId && assistantText.trim()) {
        const tid = threadId;
        await persistence.persistAssistantMessage(tid, assistantText);
      }
    } catch {}
  })();

  return {
    stream: encodedClientStream as unknown as ReadableStream<Uint8Array>,
    threadId: threadId ?? undefined,
  };
}
