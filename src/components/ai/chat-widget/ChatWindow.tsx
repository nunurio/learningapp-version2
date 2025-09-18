"use client";

import * as React from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { cn } from "@/lib/utils/cn";
import { Menu, Trash2, Plus, Maximize2, Minimize2, X, Send } from "lucide-react";
import type { ChatController } from "./useChatController";
import type { FloatingPanelController } from "./useFloatingPanel";
import { useChatAutoScroll } from "./useChatAutoScroll";

interface ChatWindowProps {
  controller: ChatController;
  floating: FloatingPanelController;
  sidebarOpen: boolean;
  setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export function ChatWindow(props: ChatWindowProps) {
  const { controller, floating, sidebarOpen, setSidebarOpen } = props;

  const autoScroll = useChatAutoScroll({
    open: floating.open,
    streaming: controller.streaming,
    pauseStreamAutoScroll: controller.pauseStreamAutoScroll,
    isStreamAutoScrollPaused: controller.isStreamAutoScrollPaused,
  });

  const { atBottom, scrollToBottom, shouldFollowDuringStream, viewportRef, endRef } = autoScroll;

  React.useLayoutEffect(() => {
    if (!floating.open) return;
    const last = controller.messages[controller.messages.length - 1];
    if (!last) return;
    const isUser = last.role === "user";
    const isAssistantStreaming = last.role === "assistant" && controller.streaming;

    if (isUser) {
      requestAnimationFrame(() => scrollToBottom("smooth"));
      return;
    }
    if (isAssistantStreaming) {
      if (!shouldFollowDuringStream()) return;
      if (atBottom) requestAnimationFrame(() => scrollToBottom("auto"));
      return;
    }
    if (atBottom) requestAnimationFrame(() => scrollToBottom("auto"));
  }, [atBottom, controller.messages, controller.streaming, floating.open, scrollToBottom, shouldFollowDuringStream]);

  const handleTextareaKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const isComposing = (event.nativeEvent as { isComposing?: boolean } | undefined)?.isComposing === true;
      if (event.key === "Enter" && !event.shiftKey && !isComposing) {
        event.preventDefault();
        void controller.send();
      }
    },
    [controller],
  );

  return (
    <Card
      role="dialog"
      aria-modal={false}
      aria-label="AI チャット"
      className={cn(
        "fixed z-[110]",
        "flex flex-col left-auto top-auto",
        "shadow-2xl data-[dragging=true]:shadow-md",
        "border-0",
        "bg-background",
        "animate-in fade-in-0 duration-200",
        floating.maximized ? "rounded-none shadow-none" : "rounded-2xl",
      )}
      data-maximized={floating.maximized ? "true" : "false"}
      ref={floating.cardRef}
      style={floating.cardStyle}
      {...floating.panelHandlers}
    >
      <CardHeader
        className={cn(
          "chat-header select-none bg-gradient-to-r from-[hsl(var(--primary-50))] to-[hsl(var(--primary-100))] py-3 px-4 sm:px-5",
          "relative after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px",
          "after:bg-gradient-to-r after:from-transparent after:via-[hsl(var(--border-default)_/_0.5)] after:to-transparent",
          floating.maximized ? "cursor-default" : "cursor-grab data-[dragging=true]:cursor-grabbing",
        )}
        data-drag-region
        data-maximized={floating.maximized ? "true" : "false"}
        onPointerDown={(event) => {
          if (floating.maximized) return;
          const target = event.target as HTMLElement | null;
          if (target && target.closest("[data-drag-ignore]")) return;
          floating.handleDragPointerDown(event);
        }}
      >
        <div className="chat-header__top">
          <Button
            variant="ghost"
            size="icon"
            aria-label="チャット履歴"
            className="chat-header__menu"
            onClick={() => {
              setSidebarOpen((prev) => {
                const next = !prev;
                if (next) void controller.refreshThreads();
                return next;
              });
            }}
            data-drag-ignore
          >
            <Menu className="h-4 w-4" />
          </Button>
          <div
            className={cn(
              "chat-header__title flex min-w-0 flex-1 items-center gap-2 font-semibold",
              floating.maximized ? "cursor-default" : "cursor-move",
            )}
            data-drag-handle
            aria-label="ドラッグで移動"
            aria-roledescription="ウィンドウのタイトルバー（ドラッグで移動）"
            role="button"
            tabIndex={-1}
          >
            <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
            <span className="truncate">アシスタント</span>
          </div>
          <div className="chat-header__context" data-drag-ignore>
            <Label htmlFor="use-page" className="chat-header__contextLabel text-xs text-muted-foreground">
              ページ文脈
            </Label>
            <Switch id="use-page" checked={controller.includePage} onCheckedChange={controller.setIncludePage} />
          </div>
          <div className="chat-header__actions" data-drag-ignore>
            {!floating.isMobile && (
              <Button
                variant="ghost"
                size="icon"
                aria-label={floating.maximized ? "最小化" : "最大化"}
                title={floating.maximized ? "最小化" : "最大化"}
                onClick={() => floating.setMaximized((prev) => !prev)}
                className="hover:bg-[hsl(var(--primary-200))] transition-colors"
              >
                {floating.maximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              aria-label="閉じる"
              onClick={floating.close}
              className="hover:bg-[hsl(var(--primary-200))] transition-colors"
              data-drag-ignore
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <Separator />
      <CardContent className="p-0 flex-1 relative overflow-hidden">
        {controller.loading && (
          <div className="absolute left-0 right-0 top-0 h-[2px] bg-gradient-to-r from-[hsl(var(--primary-400))] via-[hsl(var(--primary-500))] to-[hsl(var(--primary-400))] animate-pulse" />
        )}
        {sidebarOpen ? (
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel
              defaultSize={28}
              minSize={18}
              maxSize={42}
              collapsible
              collapsedSize={0}
              className="relative after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-gradient-to-b after:from-transparent after:via-[hsl(var(--border-default)_/_0.4)] after:to-transparent"
            >
              <div className="h-full flex flex-col">
                <div className="p-2 flex items-center justify-between bg-muted/30 relative after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-gradient-to-r after:from-transparent after:via-[hsl(var(--border-default)_/_0.4)] after:to-transparent">
                  <div className="text-xs font-medium">チャット履歴</div>
                  <Button size="sm" variant="outline" onClick={controller.createThread}>
                    <Plus className="h-3 w-3 mr-1" /> 新規
                  </Button>
                </div>
                <div className="p-2 text-xs text-muted-foreground">
                  {controller.loadingThreads ? "読み込み中…" : controller.threads.length === 0 ? "履歴はまだありません" : "最近のスレッド"}
                </div>
                <ScrollArea className="flex-1 px-2 pb-2">
                  <div className="space-y-1">
                    {controller.threads.map((thread) => (
                      <div
                        key={thread.id}
                        className={cn(
                          "group flex items-center gap-2 rounded-md border border-[hsl(220_13%_85%_/_0.6)] p-2 hover:bg-accent hover:border-[hsl(220_13%_75%_/_0.8)] cursor-pointer transition-all duration-200",
                          controller.activeThreadId === thread.id && "bg-accent border-[hsl(var(--primary-400)_/_0.3)]",
                        )}
                        onClick={() => void controller.openThread(thread.id)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="truncate text-xs font-medium">{thread.title || "無題のチャット"}</div>
                          <div className="truncate text-[10px] text-muted-foreground">{new Date(thread.updatedAt ?? thread.createdAt).toLocaleString()}</div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="削除"
                          className="opacity-0 group-hover:opacity-100"
                          onClick={(event) => {
                            event.stopPropagation();
                            void controller.deleteThread(thread.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel>{renderMessages()}</ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          renderMessages()
        )}
      </CardContent>
      <Separator />
      <CardFooter className="p-3 gap-2 bg-[hsl(var(--background))]">
        <Textarea
          placeholder="このページについて質問…"
          value={controller.input}
          onChange={(event) => controller.setInput(event.target.value)}
          onFocus={() => {
            if (controller.streaming && controller.isStreamAutoScrollPaused()) return;
            scrollToBottom("auto");
          }}
          onKeyDown={handleTextareaKeyDown}
          rows={2}
          className="resize-none transition-all duration-200 focus:shadow-lg focus:border-[hsl(var(--primary-400))]"
        />
        <Button
          onClick={() => void controller.send()}
          disabled={controller.loading || !controller.input.trim()}
          size="icon"
          aria-label="送信"
          title="送信"
          className="bg-gradient-to-r from-[hsl(var(--primary-500))] to-[hsl(var(--primary-600))] hover:from-[hsl(var(--primary-600))] hover:to-[hsl(var(--primary-700))] transition-all duration-200 hover:shadow-lg disabled:opacity-50 h-9 w-9"
        >
          <Send className="h-4 w-4" />
        </Button>
      </CardFooter>
      {!floating.maximized && (
        <div
          role="separator"
          aria-label="サイズ変更"
          aria-keyshortcuts="ArrowUp, ArrowDown, ArrowLeft, ArrowRight"
          tabIndex={0}
          onPointerDown={floating.handleResizePointerDown}
          onKeyDown={floating.handleResizeKeyDown}
          className="absolute right-0 bottom-0 p-3 cursor-se-resize opacity-60 hover:opacity-100 focus-visible:opacity-100 transition-opacity"
        >
          <div
            aria-hidden
            className="pointer-events-none h-3 w-3"
            style={{ background: "linear-gradient(135deg, transparent 50%, hsl(var(--border)) 50%)" }}
          />
        </div>
      )}
    </Card>
  );

  function renderMessages() {
    return (
      <ScrollArea className="h-full p-3 pr-4">
        <div ref={viewportRef} className="h-full overflow-y-auto pr-2 chat-scroll-container">
          {controller.messages.length === 0 && (
            <div className="text-xs text-muted-foreground p-4 text-center animate-in fade-in-50 duration-500">
              <div className="mb-2">👋 こんにちは</div>
              <div>質問を入力すると、このページの文脈を踏まえてお手伝いします。</div>
            </div>
          )}
          {controller.messages.map((message, index) => (
            <div
              key={message.id}
              className={cn(
                "mb-3 max-w-[88%] animate-in fade-in-0 slide-in-from-bottom-2 duration-300",
                message.role === "user" ? "ml-auto text-right" : "mr-auto text-left",
              )}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div
                className={cn(
                  "inline-flex w-fit max-w-full rounded-2xl px-4 py-2.5 text-xs whitespace-pre-wrap break-words transition-all duration-200 hover:shadow-md",
                  message.role === "user"
                    ? "bg-gradient-to-br from-[hsl(var(--primary-500))] to-[hsl(var(--primary-600))] text-white shadow-sm"
                    : "bg-gradient-to-br from-[hsl(var(--muted))] to-[hsl(var(--accent))] text-[hsl(var(--foreground))] shadow-sm border border-[hsl(220_13%_85%_/_0.5)]",
                )}
              >
                {message.content || (
                  <div className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-current animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="inline-block w-2 h-2 rounded-full bg-current animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="inline-block w-2 h-2 rounded-full bg-current animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={endRef} data-sentinel="chat-end" />
        </div>
      </ScrollArea>
    );
  }
}
