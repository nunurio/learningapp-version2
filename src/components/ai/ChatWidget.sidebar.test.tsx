import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
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

describe("ChatWidget sidebar & threads", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("loads thread list when opening sidebar", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(typeof input === "string" ? input : (input as URL).toString());
      if (url.includes("/api/chat/threads")) {
        return new Response(JSON.stringify([
          { id: "t1", title: "一番目", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
          { id: "t2", title: "二番目", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        ]), { headers: { "Content-Type": "application/json" } });
      }
      // default: stream OK for send (not used in this test)
      return new Response(null, { status: 404 });
    });

    render(<ChatWidget />);
    fireEvent.click(screen.getByRole("button", { name: "AIチャットを開く" }));
    fireEvent.click(screen.getByRole("button", { name: "チャット履歴" }));

    await waitFor(() => {
      expect(screen.getByText("一番目")).toBeInTheDocument();
      expect(screen.getByText("二番目")).toBeInTheDocument();
    });
  });

  it("loads messages when a thread is selected", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(typeof input === "string" ? input : (input as URL).toString());
      if (url.endsWith("/api/chat/threads")) {
        return new Response(JSON.stringify([
          { id: "t99", title: "T-99", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        ]), { headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/api/chat/threads/t99/messages")) {
        return new Response(JSON.stringify([
          { id: "m1", role: "user", content: "U", createdAt: new Date().toISOString() },
          { id: "m2", role: "assistant", content: "A", createdAt: new Date().toISOString() },
        ]), { headers: { "Content-Type": "application/json" } });
      }
      return new Response(null, { status: 404 });
    });

    render(<ChatWidget />);
    fireEvent.click(screen.getByRole("button", { name: "AIチャットを開く" }));
    fireEvent.click(screen.getByRole("button", { name: "チャット履歴" }));
    await screen.findByText("T-99");
    fireEvent.click(screen.getByText("T-99"));

    await waitFor(() => {
      expect(screen.getAllByText(/U|A/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it("sends and refreshes thread list when X-Thread-Id is returned", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(typeof input === "string" ? input : (input as URL).toString());
      if (url.endsWith("/api/ai/assistant/stream") && init?.method === "POST") {
        return new Response(streamBody("ok"), {
          status: 200,
          headers: { "X-Thread-Id": "tid-1" },
        } as ResponseInit);
      }
      if (url.endsWith("/api/chat/threads")) {
        return new Response(JSON.stringify([{ id: "tid-1", title: "T", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }]), {
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(null, { status: 404 });
    });

    render(<ChatWidget />);
    fireEvent.click(screen.getByRole("button", { name: "AIチャットを開く" }));
    const textarea = screen.getByPlaceholderText("このページについて質問…");
    fireEvent.change(textarea, { target: { value: "hello" } });
    fireEvent.click(screen.getByRole("button", { name: "送信" }));

    // ensure threads endpoint was called after send
    await waitFor(() => {
      const calls = fetchSpy.mock.calls.filter(([u]) => String(u).includes("/api/chat/threads"));
      expect(calls.length).toBeGreaterThan(0);
    });
  });
});
