import * as React from "react";
import { useAutoScroll } from "@/components/hooks/useAutoScroll";

interface UseChatAutoScrollOptions {
  open: boolean;
  streaming: boolean;
  pauseStreamAutoScroll: () => void;
  isStreamAutoScrollPaused: () => boolean;
}

interface ChatAutoScrollResult {
  viewportRef: React.MutableRefObject<HTMLDivElement | null>;
  endRef: React.MutableRefObject<HTMLDivElement | null>;
  atBottom: boolean;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  shouldFollowDuringStream: () => boolean;
}

const NEAR_BOTTOM_MARGIN = 64;

export function useChatAutoScroll(options: UseChatAutoScrollOptions): ChatAutoScrollResult {
  const { open, streaming, pauseStreamAutoScroll, isStreamAutoScrollPaused } = options;

  const viewportRef = React.useRef<HTMLDivElement>(null);
  const { endRef, atBottom, scrollToBottom } = useAutoScroll(viewportRef, { nearBottomMargin: NEAR_BOTTOM_MARGIN });

  const streamingRef = React.useRef(streaming);
  React.useEffect(() => {
    streamingRef.current = streaming;
  }, [streaming]);

  React.useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    if (!open) return;

    const markPause = () => {
      if (streamingRef.current) pauseStreamAutoScroll();
    };

    const onScroll = () => {
      if (!streamingRef.current) return;
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distance > NEAR_BOTTOM_MARGIN) pauseStreamAutoScroll();
    };

    el.addEventListener("wheel", markPause, { passive: true });
    el.addEventListener("touchstart", markPause, { passive: true });
    el.addEventListener("pointerdown", markPause, { passive: true });
    el.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      el.removeEventListener("wheel", markPause as EventListener);
      el.removeEventListener("touchstart", markPause as EventListener);
      el.removeEventListener("pointerdown", markPause as EventListener);
      el.removeEventListener("scroll", onScroll as EventListener);
    };
  }, [open, pauseStreamAutoScroll]);

  const shouldFollowDuringStream = React.useCallback(() => !isStreamAutoScrollPaused(), [isStreamAutoScrollPaused]);

  return {
    viewportRef,
    endRef,
    atBottom,
    scrollToBottom,
    shouldFollowDuringStream,
  };
}
