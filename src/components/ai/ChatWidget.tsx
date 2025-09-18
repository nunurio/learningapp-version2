"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatWindow } from "@/components/ai/chat-widget/ChatWindow";
import { useChatController } from "@/components/ai/chat-widget/useChatController";
import { useFloatingPanel } from "@/components/ai/chat-widget/useFloatingPanel";

export function ChatWidget() {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const controller = useChatController();
  const floating = useFloatingPanel();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  React.useEffect(() => {
    if (!floating.open) setSidebarOpen(false);
  }, [floating.open]);

  if (!mounted) return null;

  return (
    <>
      {typeof document !== "undefined" &&
        createPortal(
          <>
            <Button
              size="icon"
              style={floating.launcherStyle}
              className="rounded-full shadow-lg hover:shadow-xl hover:scale-110 active:scale-95"
              aria-label="AIチャットを開く"
              aria-disabled={floating.launcherLocked || undefined}
              onClick={floating.handleLauncherToggle}
            >
              <MessageCircle className="h-5 w-5" />
            </Button>
            {floating.open ? (
              <ChatWindow
                controller={controller}
                floating={floating}
                sidebarOpen={sidebarOpen}
                setSidebarOpen={setSidebarOpen}
              />
            ) : null}
          </>,
          document.body,
        )}
    </>
  );
}

export default ChatWidget;
