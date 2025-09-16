import React from "react";
import { render, screen, fireEvent, createEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ChatWidget from "./ChatWidget";

describe("ChatWidget", () => {
  const encoder = new TextEncoder();
  function mockStreamBody(text: string) {
    const chunks = [encoder.encode(text)];
    let i = 0;
    return {
      getReader: () => ({
        read: async () => {
          if (i < chunks.length) return { value: chunks[i++], done: false };
          return { value: undefined, done: true } as const;
        },
        releaseLock: () => {},
      }),
    } as unknown as ReadableStream;
  }

  beforeEach(() => {
    vi.restoreAllMocks();
    // @ts-ignore override for test
    global.fetch = vi.fn(async () => new Response(mockStreamBody("ok"), { status: 200 })) as unknown as typeof fetch;
  });
  it("opens and closes the chat panel", () => {
    render(<ChatWidget />);
    const btn = screen.getByRole("button", { name: "AIチャットを開く" });
    fireEvent.click(btn);
    const dialog = screen.getByRole("dialog", { name: "AI チャット" });
    expect(dialog).toBeInTheDocument();
    const close = screen.getByRole("button", { name: "閉じる" });
    fireEvent.click(close);
    expect(screen.queryByRole("dialog", { name: "AI チャット" })).toBeNull();
  });

  it("does not send on IME composition Enter", async () => {
    render(<ChatWidget />);
    fireEvent.click(screen.getByRole("button", { name: "AIチャットを開く" }));
    const textarea = screen.getByPlaceholderText("このページについて質問…");
    fireEvent.change(textarea, { target: { value: "こんにちは" } });

    const ev = createEvent.keyDown(textarea, { key: "Enter" });
    Object.defineProperty(ev, "isComposing", { value: true });
    fireEvent(textarea, ev);

    await waitFor(() => {
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  it("sends exactly once on rapid double Enter", async () => {
    // slow the mock a bit to keep sendingRef engaged during second press
    // @ts-ignore override for test
    global.fetch = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 10));
      return new Response(mockStreamBody("ok"), { status: 200 });
    }) as unknown as typeof fetch;

    render(<ChatWidget />);
    fireEvent.click(screen.getByRole("button", { name: "AIチャットを開く" }));
    const textarea = screen.getByPlaceholderText("このページについて質問…");
    fireEvent.change(textarea, { target: { value: "test" } });

    fireEvent.keyDown(textarea, { key: "Enter" });
    // immediately press again
    fireEvent.keyDown(textarea, { key: "Enter" });

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
  });

  it("sends via button click once", async () => {
    render(<ChatWidget />);
    fireEvent.click(screen.getByRole("button", { name: "AIチャットを開く" }));
    const textarea = screen.getByPlaceholderText("このページについて質問…");
    fireEvent.change(textarea, { target: { value: "button" } });
    const sendBtn = screen.getByRole("button", { name: "送信" });
    fireEvent.click(sendBtn);
    // double click quickly should still send once
    fireEvent.click(sendBtn);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
  });
});
