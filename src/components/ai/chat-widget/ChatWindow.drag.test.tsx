import * as React from "react";
import { render, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import type { ChatController } from "@/components/ai/chat-widget/useChatController";
import type { FloatingPanelController } from "@/components/ai/chat-widget/useFloatingPanel";
import { ChatWindow } from "@/components/ai/chat-widget/ChatWindow";

function createFloatingStub(overrides?: Partial<FloatingPanelController>): FloatingPanelController {
  const handleDragPointerDown = vi.fn();
  const floating: FloatingPanelController = {
    open: true,
    setOpen: vi.fn(),
    toggleOpen: vi.fn(),
    close: vi.fn(),
    maximized: false,
    setMaximized: vi.fn(),
    isMobile: false,
    cardRef: React.createRef<HTMLDivElement>(),
    cardStyle: {},
    panelHandlers: {
      onPointerDownCapture: vi.fn(),
      onPointerUpCapture: vi.fn(),
      onPointerCancelCapture: vi.fn(),
      onClickCapture: vi.fn(),
      onClick: vi.fn(),
    },
    launcherStyle: {},
    launcherLocked: false,
    handleLauncherToggle: vi.fn(),
    handleDragPointerDown,
    handleResizePointerDown: vi.fn(),
    handleResizeKeyDown: vi.fn(),
    handleDragHandleKeyDown: vi.fn(),
  };
  return { ...floating, ...overrides };
}

function createControllerStub(overrides?: Partial<ChatController>): ChatController {
  const controller: ChatController = {
    messages: [],
    input: "",
    setInput: vi.fn(),
    includePage: true,
    setIncludePage: vi.fn(),
    loading: false,
    streaming: false,
    loadingThreads: false,
    threads: [],
    activeThreadId: null,
    openThread: vi.fn(async () => {}),
    createThread: vi.fn(),
    refreshThreads: vi.fn(async () => {}),
    deleteThread: vi.fn(async () => {}),
    send: vi.fn(async () => {}),
    pauseStreamAutoScroll: vi.fn(),
    resetStreamAutoScroll: vi.fn(),
    isStreamAutoScrollPaused: vi.fn(() => false),
  };
  return { ...controller, ...overrides };
}

describe("ChatWindow drag affordance", () => {
  it("starts dragging when pressing the header area outside ignored controls", () => {
    const floating = createFloatingStub();
    const controller = createControllerStub();
    const { container } = render(
      <ChatWindow controller={controller} floating={floating} sidebarOpen={false} setSidebarOpen={vi.fn()} />,
    );

    const header = container.querySelector("[data-drag-region]") as HTMLElement;
    expect(header).toBeTruthy();

    const title = header.querySelector(".chat-header__title") as HTMLElement;
    fireEvent.pointerDown(title, { pointerId: 1, button: 0, clientX: 4, clientY: 4, pointerType: "mouse" });

    expect(floating.handleDragPointerDown).toHaveBeenCalledTimes(1);
  });

  it("does not start dragging when interacting with buttons marked as ignored", () => {
    const floating = createFloatingStub();
    const controller = createControllerStub();
    const { container, getByLabelText } = render(
      <ChatWindow controller={controller} floating={floating} sidebarOpen={false} setSidebarOpen={vi.fn()} />,
    );

    const header = container.querySelector("[data-drag-region]") as HTMLElement;
    expect(header).toBeTruthy();

    const menuButton = getByLabelText("チャット履歴");
    fireEvent.pointerDown(menuButton, { pointerId: 1, button: 0, clientX: 4, clientY: 4, pointerType: "mouse" });

    expect(floating.handleDragPointerDown).not.toHaveBeenCalled();

    const closeButton = getByLabelText("閉じる");
    fireEvent.pointerDown(closeButton, { pointerId: 2, button: 0, clientX: 8, clientY: 8, pointerType: "mouse" });

    expect(floating.handleDragPointerDown).not.toHaveBeenCalled();

    const title = header.querySelector(".chat-header__title") as HTMLElement;
    fireEvent.pointerDown(title, { pointerId: 3, button: 0, clientX: 10, clientY: 12, pointerType: "mouse" });

    expect(floating.handleDragPointerDown).toHaveBeenCalledTimes(1);
  });
});
