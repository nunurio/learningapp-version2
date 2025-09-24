import { afterEach, describe, expect, test, vi } from "vitest";
import { createAssistantStream } from "@/lib/ai/assistant/stream";
import type { AssistantPersistence } from "@/lib/ai/assistant/stream";
import type { AssistantRequestPayload } from "@/lib/ai/assistant/request";
import * as contextTools from "@/lib/ai/tools/context-tools";
import type { ContextBundle } from "@/lib/ai/tools/context-tools";
import type { Database } from "@/lib/database.types";

const originalAiMock = process.env.AI_MOCK;
const originalApiKey = process.env.OPENAI_API_KEY;

async function readStream(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let text = "";

  while (true) {
    const readPromise = reader.read();
    await vi.advanceTimersByTimeAsync(20);
    const { value, done } = await readPromise;
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  await vi.runAllTimersAsync();
  return text;
}

describe("createAssistantStream", () => {
  afterEach(() => {
    process.env.AI_MOCK = originalAiMock;
    process.env.OPENAI_API_KEY = originalApiKey;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test("uses mock stream and persists messages", async () => {
    process.env.AI_MOCK = "1";
    process.env.OPENAI_API_KEY = undefined;
    vi.useFakeTimers();

    const persistence: AssistantPersistence = {
      ensureThreadId: vi.fn().mockResolvedValue("thread-123"),
      persistUserMessage: vi.fn().mockResolvedValue(undefined),
      persistAssistantMessage: vi.fn().mockResolvedValue(undefined),
    };

    const request: AssistantRequestPayload = {
      userText: "Hello there",
      pageText: "Some page context",
      history: [],
      requestedThreadId: undefined,
      activeRef: undefined,
    };

    const result = await createAssistantStream({ request, persistence });
    const output = await readStream(result.stream);

    expect(result.threadId).toBe("thread-123");
    expect(output).toContain("ご質問ありがとうございます。");
    expect(output).toContain("質問: Hello there");
    expect(output).toContain("【参照した文脈（要約）】\nSome page context");
    expect(persistence.ensureThreadId).toHaveBeenCalledWith(undefined, "Hello there");
    expect(persistence.persistUserMessage).toHaveBeenCalledWith("thread-123", "Hello there");
    expect(persistence.persistAssistantMessage).toHaveBeenCalledTimes(1);
    expect(persistence.persistAssistantMessage).toHaveBeenCalledWith(
      "thread-123",
      expect.stringContaining("ご質問ありがとうございます。")
    );
  });

  test("enriches first turn with active card context when available", async () => {
    process.env.AI_MOCK = "1";
    process.env.OPENAI_API_KEY = undefined;
    vi.useFakeTimers();

    const persistence: AssistantPersistence = {
      ensureThreadId: vi.fn().mockResolvedValue("thread-xyz"),
      persistUserMessage: vi.fn().mockResolvedValue(undefined),
      persistAssistantMessage: vi.fn().mockResolvedValue(undefined),
    };

    const request: AssistantRequestPayload = {
      userText: "Original question",
      pageText: null,
      history: [],
      requestedThreadId: undefined,
      activeRef: { cardId: "card-1" },
    };

    const cardType = "text" as Database["public"]["Enums"]["card_type"];
    const bundle: ContextBundle = {
      ref: { cardId: "card-1" },
      card: {
        id: "card-1",
        lessonId: "lesson-1",
        cardType,
        title: "Card Title",
        tags: [],
        orderIndex: 1,
        content: { body: "Explanation of the card." },
      },
      lesson: {
        id: "lesson-1",
        courseId: "course-1",
        title: "Lesson Title",
        orderIndex: 1,
      },
      course: {
        id: "course-1",
        title: "Course Title",
        description: null,
        category: null,
      },
      neighbors: undefined,
      progress: undefined,
      flagged: false,
      note: undefined,
    };

    vi.spyOn(contextTools, "getContextBundle").mockResolvedValue(bundle);

    const result = await createAssistantStream({
      request,
      persistence,
      supabase: {} as Parameters<typeof createAssistantStream>[0]["supabase"],
      userId: "user-1",
    });
    const output = await readStream(result.stream);

    expect(output).toContain("【現在開いているカード情報】");
    expect(output).toContain("Original question");

    const getContextBundleMock = vi.mocked(contextTools.getContextBundle);
    const contextArgs = getContextBundleMock.mock.calls.at(-1)?.[0];
    expect(contextArgs).toBeDefined();
    expect(contextArgs?.ref).toEqual({ cardId: "card-1" });
    expect(contextArgs?.userId).toBe("user-1");
    expect(contextArgs?.include).toEqual({
      neighbors: false,
      progress: false,
      flags: false,
      notes: false,
      maxBody: 1600,
    });
    expect(persistence.persistUserMessage).toHaveBeenCalledWith("thread-xyz", "Original question");
    expect(persistence.persistAssistantMessage).toHaveBeenCalledWith(
      "thread-xyz",
      expect.any(String)
    );
  });
});
