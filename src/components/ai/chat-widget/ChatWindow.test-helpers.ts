import * as React from "react";
import { vi } from "vitest";
import type { ChatController } from "@/components/ai/chat-widget/useChatController";
import type { FloatingPanelController } from "@/components/ai/chat-widget/useFloatingPanel";

export type StubOverrides = {
  floating?: Partial<FloatingPanelController>;
  controller?: Partial<ChatController>;
};

export function createFloatingStub(overrides?: Partial<FloatingPanelController>): FloatingPanelController {
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
    handleDragPointerDown: vi.fn(),
    handleResizePointerDown: vi.fn(),
    handleResizeKeyDown: vi.fn(),
    handleDragHandleKeyDown: vi.fn(),
  };
  return { ...floating, ...overrides };
}

export function createControllerStub(overrides?: Partial<ChatController>): ChatController {
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
