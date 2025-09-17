import { describe, expect, test } from "vitest";
import { parseAssistantRequest } from "@/lib/ai/assistant/request";

function buildRequest(body: Record<string, unknown>) {
  return new Request("https://example.com/api/ai/assistant", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("parseAssistantRequest", () => {
  test("sanitizes text, trims history, and builds page context", async () => {
    const longMessage = `contact me at friend@example.com ${"a".repeat(900)}`;
    const history = Array.from({ length: 14 }, (_, idx) => ({
      role: idx % 2 === 0 ? "user" : "assistant",
      content: `Entry ${idx} call 090-1234-5678 and mail test${idx}@example.com`,
    }));
    history[3] = { role: "assistant", content: "   " };

    const request = buildRequest({
      message: longMessage,
      includePage: true,
      page: {
        title: "Example Page",
        url: "https://example.com/page",
        selection: "Reach me at friend@example.com",
        headings: ["Intro", "Details"],
        contentSnippet: "This is a long content snippet.",
      },
      history,
      threadId: "123e4567-e89b-12d3-a456-426614174000",
      activeRef: { cardId: "card-123" },
    });

    const result = await parseAssistantRequest(request);

    expect(result.userText.length).toBeLessThanOrEqual(800);
    expect(result.userText).toContain("f***@***.com");

    expect(result.history).toHaveLength(12);
    expect(result.history.every((entry) => entry.content.length <= 800)).toBe(true);
    expect(result.history.some((entry) => entry.content.includes("09***78"))).toBe(true);
    expect(result.history.every((entry) => entry.content.trim().length > 0)).toBe(true);

    expect(result.pageText).toBeTruthy();
    expect(result.pageText).toContain("Title: Example Page");
    expect(result.pageText).toContain("Headings: Intro | Details");
    expect(result.pageText).toContain("f***@***.com");

    expect(result.requestedThreadId).toBe("123e4567-e89b-12d3-a456-426614174000");
    expect(result.activeRef).toEqual({ cardId: "card-123" });
  });

  test("returns minimal payload when optional fields are omitted", async () => {
    const request = buildRequest({
      message: "Hello",
    });

    const result = await parseAssistantRequest(request);

    expect(result.userText).toBe("Hello");
    expect(result.pageText).toBeNull();
    expect(result.history).toHaveLength(0);
    expect(result.requestedThreadId).toBeUndefined();
    expect(result.activeRef).toBeUndefined();
  });
});
