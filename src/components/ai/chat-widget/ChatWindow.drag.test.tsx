import * as React from "react";
import { render, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ChatWindow } from "@/components/ai/chat-widget/ChatWindow";
import { createFloatingStub, createControllerStub, type StubOverrides } from "./ChatWindow.test-helpers";

function renderChatWindow(overrides?: StubOverrides) {
  const floating = createFloatingStub(overrides?.floating);
  const controller = createControllerStub(overrides?.controller);
  const renderResult = render(
    <ChatWindow controller={controller} floating={floating} sidebarOpen={false} setSidebarOpen={vi.fn()} />,
  );

  const header = renderResult.container.querySelector("[data-drag-region]") as HTMLElement | null;
  if (!header) throw new Error("chat header not found");

  return { floating, controller, header, ...renderResult };
}

interface PointerOptions {
  target: Element;
  pointerId?: number;
  clientX?: number;
  clientY?: number;
}

function pointerDown({ target, pointerId = 1, clientX = 4, clientY = 4 }: PointerOptions) {
  fireEvent.pointerDown(target, {
    pointerId,
    button: 0,
    pointerType: "mouse",
    clientX,
    clientY,
  });
}

describe("ChatWindow drag affordance", () => {
  it("starts dragging when pressing the header area outside ignored controls", () => {
    const { floating, header } = renderChatWindow();
    const title = header.querySelector(".chat-header__title");
    expect(title).toBeTruthy();

    if (!title) throw new Error("title element not found");
    pointerDown({ target: title });

    expect(floating.handleDragPointerDown).toHaveBeenCalledTimes(1);
  });

  it("does not start dragging when interacting with buttons marked as ignored", () => {
    const { floating, header, getByLabelText } = renderChatWindow();

    pointerDown({ target: getByLabelText("チャット履歴") });
    expect(floating.handleDragPointerDown).not.toHaveBeenCalled();

    pointerDown({ target: getByLabelText("閉じる"), pointerId: 2, clientX: 8, clientY: 8 });
    expect(floating.handleDragPointerDown).not.toHaveBeenCalled();

    const title = header.querySelector(".chat-header__title");
    expect(title).toBeTruthy();

    if (!title) throw new Error("title element not found");
    pointerDown({ target: title, pointerId: 3, clientX: 10, clientY: 12 });

    expect(floating.handleDragPointerDown).toHaveBeenCalledTimes(1);
  });
});
