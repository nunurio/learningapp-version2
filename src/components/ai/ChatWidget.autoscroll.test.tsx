import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import ChatWidget from "./ChatWidget";

const encoder = new TextEncoder();
function streamBody(text: string) {
  let i = 0;
  const chunks = [encoder.encode(text)];
  return {
    getReader: () => ({
      read: async () => (i < chunks.length ? { value: chunks[i++], done: false } : { value: undefined, done: true } as const),
      releaseLock: () => {},
    }),
  } as unknown as ReadableStream<Uint8Array>;
}

describe("ChatWidget auto scroll", () => {
  let scrollIntoViewMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    // JSDOM では未実装のためメソッドを生やす
    scrollIntoViewMock = vi.fn();
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      value: scrollIntoViewMock,
      configurable: true,
      writable: true,
    });
  });
  afterEach(() => {
    // noop
  });

  it("scrolls to bottom on send and stream", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(typeof input === "string" ? input : (input as URL).toString());
      if (url.endsWith("/api/ai/assistant/stream") && init?.method === "POST") {
        return new Response(streamBody("ok"), { status: 200 } as ResponseInit);
      }
      if (url.endsWith("/api/chat/threads")) {
        return new Response(JSON.stringify([]), { headers: { "Content-Type": "application/json" } });
      }
      return new Response(null, { status: 404 });
    });

    render(<ChatWidget />);
    fireEvent.click(screen.getByRole("button", { name: "AIチャットを開く" }));
    const textarea = screen.getByPlaceholderText("このページについて質問…");
    fireEvent.change(textarea, { target: { value: "hello" } });
    fireEvent.click(screen.getByRole("button", { name: "送信" }));

    await waitFor(() => {
      expect(scrollIntoViewMock).toHaveBeenCalled();
    });
  });
});
