import * as React from "react";
import { render, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ChatWindow } from "@/components/ai/chat-widget/ChatWindow";
import { createControllerStub, createFloatingStub } from "@/components/ai/chat-widget/ChatWindow.test-helpers";

describe("ChatWindow body scroll lock", () => {
  it("does not lock the document body scroll while the chat window is mounted", async () => {
    const floating = createFloatingStub();
    const controller = createControllerStub();

    const initialOverflow = document.body.style.overflow;
    const initialTouchAction = document.documentElement.style.getPropertyValue("touch-action");
    expect(initialOverflow).toBe("");
    expect(initialTouchAction).toBe("");

    const { unmount } = render(
      <ChatWindow controller={controller} floating={floating} sidebarOpen={false} setSidebarOpen={vi.fn()} />,
    );

    await waitFor(() => {
      expect(document.body.style.overflow).toBe(initialOverflow);
      expect(document.documentElement.style.getPropertyValue("touch-action")).toBe(initialTouchAction);
    });

    unmount();

    expect(document.body.style.overflow).toBe(initialOverflow);
    expect(document.documentElement.style.getPropertyValue("touch-action")).toBe(initialTouchAction);
  });
});
