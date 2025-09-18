import * as React from "react";
import { toast } from "@/components/ui/toaster";
import { usePageContext } from "@/components/ai/use-page-context";
import { getActiveRef, useActiveRef } from "@/components/ai/active-ref";
import { uid } from "@/lib/utils/uid";
import type { ChatThread } from "@/lib/types";

type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  timestamp?: Date;
};

type HistoryItem = { role: ChatRole; content: string };

interface UseChatControllerOptions {
  autoScrollResetDelayMs?: number;
}

export interface ChatController {
  messages: ChatMessage[];
  input: string;
  setInput: (value: string) => void;
  includePage: boolean;
  setIncludePage: (value: boolean) => void;
  loading: boolean;
  streaming: boolean;
  loadingThreads: boolean;
  threads: ChatThread[];
  activeThreadId: string | null;
  openThread: (threadId: string) => Promise<void>;
  createThread: () => void;
  refreshThreads: () => Promise<void>;
  deleteThread: (threadId: string) => Promise<void>;
  send: () => Promise<void>;
  pauseStreamAutoScroll: () => void;
  resetStreamAutoScroll: () => void;
  isStreamAutoScrollPaused: () => boolean;
}

const DEFAULT_OPTIONS: UseChatControllerOptions = {
  autoScrollResetDelayMs: 0,
};

export function useChatController(options?: UseChatControllerOptions): ChatController {
  const { autoScrollResetDelayMs } = { ...DEFAULT_OPTIONS, ...options };
  const { context, refresh } = usePageContext();
  const liveActiveRef = useActiveRef();

  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [includePage, setIncludePageState] = React.useState(true);
  const [loading, setLoading] = React.useState(false);
  const [loadingThreads, setLoadingThreads] = React.useState(false);
  const [threads, setThreads] = React.useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = React.useState<string | null>(null);
  const [streaming, setStreaming] = React.useState(false);

  const sendingRef = React.useRef(false);
  const streamingRef = React.useRef(false);
  const pauseAutoScrollThisStreamRef = React.useRef(false);
  const autoScrollResetTimerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    return () => {
      if (autoScrollResetTimerRef.current != null) {
        clearTimeout(autoScrollResetTimerRef.current);
        autoScrollResetTimerRef.current = null;
      }
    };
  }, []);

  const refreshThreads = React.useCallback(async () => {
    try {
      setLoadingThreads(true);
      const res = await fetch("/api/chat/threads", {
        method: "GET",
        headers: { "Cache-Control": "no-store" },
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.toLowerCase().includes("application/json")) {
        return;
      }
      const data = (await res.json()) as ChatThread[];
      setThreads(data);
    } catch (error) {
      console.warn("loadThreads failed", error);
    } finally {
      setLoadingThreads(false);
    }
  }, []);

  const loadMessages = React.useCallback(async (threadId: string) => {
    try {
      const res = await fetch(`/api/chat/threads/${threadId}/messages`, {
        method: "GET",
        headers: { "Cache-Control": "no-store" },
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.toLowerCase().includes("application/json")) {
        return;
      }
      const data = (await res.json()) as { id: string; role: ChatRole; content: string; createdAt: string }[];
      setMessages(
        data.map((item) => ({
          id: item.id,
          role: item.role,
          content: item.content,
          timestamp: new Date(item.createdAt),
        })),
      );
    } catch (error) {
      console.warn("loadMessages failed", error);
    }
  }, []);

  const openThread = React.useCallback(
    async (threadId: string) => {
      setActiveThreadId(threadId);
      await loadMessages(threadId);
    },
    [loadMessages],
  );

  const createThread = React.useCallback(() => {
    setActiveThreadId(null);
    setMessages([]);
  }, []);

  const deleteThread = React.useCallback(
    async (threadId: string) => {
      try {
        const res = await fetch(`/api/chat/threads/${threadId}`, { method: "DELETE" });
        if (!res.ok) throw new Error(`status ${res.status}`);
        setThreads((list) => list.filter((thread) => thread.id !== threadId));
        if (activeThreadId === threadId) {
          setActiveThreadId(null);
          setMessages([]);
        }
      } catch (error) {
        toast({
          title: "削除に失敗しました",
          description: error instanceof Error ? error.message : String(error),
          variant: "destructive",
        });
      }
    },
    [activeThreadId],
  );

  const resetStreamAutoScroll = React.useCallback(() => {
    pauseAutoScrollThisStreamRef.current = false;
    if (autoScrollResetTimerRef.current != null) {
      clearTimeout(autoScrollResetTimerRef.current);
      autoScrollResetTimerRef.current = null;
    }
    if (autoScrollResetDelayMs && autoScrollResetDelayMs > 0) {
      autoScrollResetTimerRef.current = window.setTimeout(() => {
        pauseAutoScrollThisStreamRef.current = false;
        autoScrollResetTimerRef.current = null;
      }, autoScrollResetDelayMs);
    }
  }, [autoScrollResetDelayMs]);

  const pauseStreamAutoScroll = React.useCallback(() => {
    if (streamingRef.current) {
      pauseAutoScrollThisStreamRef.current = true;
    }
  }, []);

  const isStreamAutoScrollPaused = React.useCallback(() => pauseAutoScrollThisStreamRef.current, []);

  const send = React.useCallback(async () => {
    if (sendingRef.current) return;
    const text = input.trim();
    if (!text) return;
    sendingRef.current = true;

    const activeRefPayload = context?.activeRef ?? liveActiveRef ?? getActiveRef();
    const basePagePayload = context
      ? { ...context, activeRef: activeRefPayload ?? context.activeRef ?? undefined }
      : activeRefPayload
        ? { activeRef: activeRefPayload }
        : undefined;

    const canIncludePage = includePage && Boolean(basePagePayload);
    if (includePage && !canIncludePage) {
      toast({
        title: "カード情報を準備しています",
        description: "文脈がまだ揃っていないため、このメッセージはページ文脈なしで送信します。",
      });
      if (!context) refresh();
    }

    const historyForServer: HistoryItem[] = messages
      .filter((message) => message.content.trim().length > 0)
      .map((message) => ({ role: message.role, content: message.content }));

    setInput("");
    setLoading(true);
    setMessages((prev) => [
      ...prev,
      { id: uid(), role: "user", content: text, timestamp: new Date() },
      { id: uid(), role: "assistant", content: "", timestamp: new Date() },
    ]);

    try {
      const res = await fetch("/api/ai/assistant/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          includePage: canIncludePage,
          page: canIncludePage ? basePagePayload : undefined,
          history: historyForServer,
          threadId: activeThreadId ?? undefined,
          activeRef: activeRefPayload ?? undefined,
        }),
      });

      if (!res.ok || !res.body) {
        try {
          const data: unknown = await res.json();
          const err = typeof data === "object" && data && "error" in data ? String((data as { error?: unknown }).error ?? "") : "";
          throw new Error(`failed: ${res.status}${err ? ` - ${err}` : ""}`);
        } catch (error) {
          throw new Error(`failed: ${res.status}${error instanceof Error ? ` - ${error.message}` : ""}`);
        }
      }

      const tid = res.headers.get("X-Thread-Id");
      if (tid && (!activeThreadId || activeThreadId !== tid)) {
        setActiveThreadId(tid);
        void refreshThreads();
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      resetStreamAutoScroll();
      streamingRef.current = true;
      setStreaming(true);

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: !done });
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (!last || last.role !== "assistant") return prev;
            const updated = { ...last, content: last.content + chunk };
            return [...prev.slice(0, -1), updated];
          });
        }
      }

      void refreshThreads();

      const tail = decoder.decode();
      if (tail) {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (!last || last.role !== "assistant") return prev;
          const updated = { ...last, content: last.content + tail };
          return [...prev.slice(0, -1), updated];
        });
      }
    } catch (error) {
      console.error(error);
      toast({
        title: "チャット送信に失敗しました",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      sendingRef.current = false;
      streamingRef.current = false;
      setStreaming(false);
      resetStreamAutoScroll();
    }
  }, [
    activeThreadId,
    context,
    includePage,
    input,
    liveActiveRef,
    messages,
    refresh,
    resetStreamAutoScroll,
  ]);

  const setIncludePage = React.useCallback(
    (value: boolean) => {
      setIncludePageState(value);
      if (value) refresh();
    },
    [refresh],
  );

  return {
    messages,
    input,
    setInput,
    includePage,
    setIncludePage,
    loading,
    streaming,
    loadingThreads,
    threads,
    activeThreadId,
    openThread,
    createThread,
    refreshThreads,
    deleteThread,
    send,
    pauseStreamAutoScroll,
    resetStreamAutoScroll,
    isStreamAutoScrollPaused,
  };
}
