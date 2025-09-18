import * as React from "react";
import { render, within, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ChatWindow } from "@/components/ai/chat-widget/ChatWindow";
import { createFloatingStub, createControllerStub } from "./ChatWindow.test-helpers";

describe("ChatWindow sidebar", () => {
  it("renders a labelled scroll area within a non-scrolling panel", () => {
    const threads = Array.from({ length: 20 }, (_, index) => ({
      id: `thread-${index}`,
      title: `Thread ${index}`,
      createdAt: new Date("2023-01-01T00:00:00Z").toISOString(),
      updatedAt: new Date("2023-01-01T00:00:00Z").toISOString(),
    }));

    const controller = createControllerStub({ threads });
    const floating = createFloatingStub();

    const { getByText, getByLabelText } = render(
      <ChatWindow controller={controller} floating={floating} sidebarOpen setSidebarOpen={vi.fn()} />,
    );

    const sidebarPanel = getByText("チャット履歴").closest("[data-panel]");
    expect(sidebarPanel).toBeTruthy();
    if (!sidebarPanel) throw new Error("sidebar panel not found");
    if (!(sidebarPanel instanceof HTMLElement)) throw new Error("sidebar panel is not an HTMLElement");

    expect(sidebarPanel.style.overflow).toBe("hidden");

    const scrollArea = getByLabelText("チャット履歴一覧");
    expect(scrollArea).toBeTruthy();

    const viewport = scrollArea.querySelector("[data-radix-scroll-area-viewport]");
    expect(viewport).toBeTruthy();
    if (!(viewport instanceof HTMLElement)) throw new Error("viewport not found");

    expect(viewport.className).toContain("overscroll-contain");

    expect(viewport.style.overflowY).toBe("scroll");

    const bodyWheel = vi.fn();
    document.body.addEventListener("wheel", bodyWheel);
    fireEvent.wheel(viewport, { deltaY: 24, bubbles: true });
    expect(bodyWheel).not.toHaveBeenCalled();
    document.body.removeEventListener("wheel", bodyWheel);

    const content = within(scrollArea).getByTestId("chat-sidebar-scroll-content");
    expect(content.className).toContain("px-2");
    expect(content.className).toContain("pb-2");

    expect(() => within(scrollArea).getByText("Thread 0")).not.toThrow();
  });
});
