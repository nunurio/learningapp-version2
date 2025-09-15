"use client";
import * as React from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { toast } from "@/components/ui/toaster";
import { MessageCircle, Send, X, Menu, Trash2, Plus } from "lucide-react";
import { usePageContext } from "@/components/ai/use-page-context";
import { uid } from "@/lib/utils/uid";
import { cn } from "@/lib/utils/cn";
import type { ChatThread } from "@/lib/types";

type Msg = { id: string; role: "user" | "assistant"; content: string; timestamp?: Date };

export function ChatWidget() {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const [open, setOpen] = React.useState(false);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [includePage, setIncludePage] = React.useState(true);
  const [messages, setMessages] = React.useState<Msg[]>([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [loadingThreads, setLoadingThreads] = React.useState(false);
  const [threads, setThreads] = React.useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = React.useState<string | null>(null);
  const { context, refresh } = usePageContext();
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const cardRef = React.useRef<HTMLDivElement>(null);

  // refs for rAF-driven dragging/resizing (avoid per-move re-render)
  const posRef = React.useRef<{ right: number; bottom: number }>({ right: 16, bottom: 16 });
  const sizeRef = React.useRef<{ w: number; h: number }>({ w: 360, h: 480 });
  const rafRef = React.useRef<number | null>(null);
  // 送信の二重実行（超短時間での多重呼び出し）を同期的に抑止
  const sendingRef = React.useRef(false);

  // position & size state (draggable + resizable)
  const [pos, setPos] = React.useState<{ right: number; bottom: number }>({ right: 16, bottom: 16 });
  const [size, setSize] = React.useState<{ w: number; h: number }>({ w: 360, h: 480 });

  const MARGIN = 8;
  function clampPos(w: number, h: number, right: number, bottom: number) {
    try {
      const iw = window.innerWidth;
      const ih = window.innerHeight;
      const maxRight = Math.max(MARGIN, iw - w - MARGIN);
      const maxBottom = Math.max(MARGIN, ih - h - MARGIN);
      return {
        right: Math.min(Math.max(MARGIN, right), maxRight),
        bottom: Math.min(Math.max(MARGIN, bottom), maxBottom),
      };
    } catch {
      return { right, bottom };
    }
  }

  React.useEffect(() => {
    if (!open) return;
    const el = viewportRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, open]);

  // keep refs in sync with state
  React.useEffect(() => { posRef.current = pos; }, [pos]);
  React.useEffect(() => { sizeRef.current = size; }, [size]);

  // helpers for direct style apply (avoid React re-render during drag)
  const applyPosStyle = React.useCallback((right: number, bottom: number) => {
    const el = cardRef.current;
    if (!el) return;
    el.style.right = `${right}px`;
    el.style.bottom = `${bottom}px`;
  }, []);
  const clearPosStyle = React.useCallback(() => {
    const el = cardRef.current;
    if (!el) return;
    el.style.right = "";
    el.style.bottom = "";
  }, []);

  const onDragMouseDown = (e: React.PointerEvent) => {
    const target = e.currentTarget as HTMLElement | null;
    const pointerId = e.pointerId;
    // Prevent scroll/selection during drag for touch/mouse
    if (target) target.style.touchAction = "none";
    const startX = e.clientX;
    const startY = e.clientY;
    const startPos = { ...posRef.current };
    try { target?.setPointerCapture(pointerId); } catch {}
    // 軽量化のため state を使わず、DOM にドラッグ中フラグを付与し、遷移を無効化
    if (cardRef.current) {
      cardRef.current.dataset.dragging = "true";
      cardRef.current.style.transition = "none";
    }
    if (target) target.dataset.dragging = "true";

    let lastDx = 0;
    let lastDy = 0;
    const onMove = (ev: PointerEvent) => {
      lastDx = ev.clientX - startX;
      lastDy = ev.clientY - startY;
      // clamp in right/bottom space and convert back to dx/dy
      const next = clampPos(sizeRef.current.w, sizeRef.current.h, startPos.right - lastDx, startPos.bottom - lastDy);
      // 位置を right/bottom に即時反映（transform と干渉しない）
      applyPosStyle(next.right, next.bottom);
    };

    const onUp = (_ev: PointerEvent) => {
      try { target?.releasePointerCapture(pointerId); } catch {}
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (rafRef.current != null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      // commit final position
      const next = clampPos(sizeRef.current.w, sizeRef.current.h, startPos.right - lastDx, startPos.bottom - lastDy);
      setPos(next);
      clearPosStyle();
      if (target) target.style.touchAction = "";
      if (cardRef.current) {
        delete cardRef.current.dataset.dragging;
        cardRef.current.style.transition = "";
      }
      if (target) delete target.dataset.dragging;
    };

    window.addEventListener("pointermove", onMove, { passive: true } as AddEventListenerOptions);
    window.addEventListener("pointerup", onUp, { passive: true } as AddEventListenerOptions);
  };

  const onResizeMouseDown = (e: React.PointerEvent) => {
    const target = e.currentTarget as HTMLElement | null;
    const pointerId = e.pointerId;
    try { target?.setPointerCapture(pointerId); } catch {}
    const startX = e.clientX;
    const startY = e.clientY;
    const startSize = { ...sizeRef.current };
    const startPos = { ...posRef.current };

    let lastW = startSize.w;
    let lastH = startSize.h;
    let lastRight = startPos.right;
    let lastBottom = startPos.bottom;

    if (cardRef.current) {
      cardRef.current.dataset.resizing = "true";
      cardRef.current.style.transition = "none";
    }

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      // 右下ハンドルをドラッグした方向へ拡大/縮小（ハンドル側の角が動く）
      const nextW = Math.min(560, Math.max(320, startSize.w + dx));
      const nextH = Math.min(640, Math.max(280, startSize.h + dy));
      const dW = nextW - startSize.w;
      const dH = nextH - startSize.h;
      const unclampedRight = startPos.right - dW; // 右下角がマウスに追従
      const unclampedBottom = startPos.bottom - dH;
      const clamped = clampPos(nextW, nextH, unclampedRight, unclampedBottom);
      lastW = nextW;
      lastH = nextH;
      lastRight = clamped.right;
      lastBottom = clamped.bottom;
      const el = cardRef.current;
      if (el) {
        // リサイズは即時反映（入力遅延を最小化）
        el.style.width = `${lastW}px`;
        el.style.height = `${lastH}px`;
        // 位置も同時に適用（ハンドルがポインタに追従）
        el.style.right = `${lastRight}px`;
        el.style.bottom = `${lastBottom}px`;
      }
    };

    const onUp = (_ev: PointerEvent) => {
      try { target?.releasePointerCapture(pointerId); } catch {}
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (rafRef.current != null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      // commit final size and position so it stays inside viewport
      const nextSize = { w: lastW, h: lastH };
      setSize(nextSize);
      const nextPos = clampPos(nextSize.w, nextSize.h, lastRight, lastBottom);
      setPos(nextPos);
      // clear inline width/height so React style remains source of truth
      const el = cardRef.current;
      if (el) {
        el.style.width = "";
        el.style.height = "";
        el.style.right = "";
        el.style.bottom = "";
        delete el.dataset.resizing;
        el.style.transition = "";
      }
    };

    window.addEventListener("pointermove", onMove, { passive: true } as AddEventListenerOptions);
    window.addEventListener("pointerup", onUp, { passive: true } as AddEventListenerOptions);
  };

  // --- Chat history (threads) ----------------------------------------
  async function loadThreads() {
    try {
      setLoadingThreads(true);
      const res = await fetch("/api/chat/threads", { method: "GET", headers: { "Cache-Control": "no-store" } });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as ChatThread[];
      setThreads(data);
    } catch (e) {
      console.warn("loadThreads failed", e);
    } finally {
      setLoadingThreads(false);
    }
  }

  async function loadMessages(tid: string) {
    try {
      const res = await fetch(`/api/chat/threads/${tid}/messages`, { method: "GET", headers: { "Cache-Control": "no-store" } });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as { id: string; role: "user" | "assistant"; content: string; createdAt: string }[];
      setMessages(data.map((m) => ({ id: m.id, role: m.role, content: m.content, timestamp: new Date(m.createdAt) })));
    } catch (e) {
      console.warn("loadMessages failed", e);
    }
  }

  async function deleteThread(tid: string) {
    try {
      const res = await fetch(`/api/chat/threads/${tid}`, { method: "DELETE" });
      if (!res.ok) throw new Error(String(res.status));
      setThreads((arr) => arr.filter((t) => t.id !== tid));
      if (activeThreadId === tid) {
        setActiveThreadId(null);
        setMessages([]);
      }
    } catch (e) {
      toast({ title: "削除に失敗しました", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  }

  // in-panel sidebar用: 新規チャットは必要な箇所で inline 実装

  async function send() {
    if (sendingRef.current) return; // 直近の呼び出し中は無視
    sendingRef.current = true;
    const text = input.trim();
    if (!text) return;
    // 送信前に現在までの履歴を確定しておく（この turn の user 発話は別フィールドで送る）
    const historyForServer = messages
      .filter((m) => m.content.trim().length > 0)
      .map((m) => ({ role: m.role, content: m.content }));
    setInput("");
    setLoading(true);
    setMessages((s) => [...s, { id: uid(), role: "user", content: text, timestamp: new Date() }, { id: uid(), role: "assistant", content: "", timestamp: new Date() }]);
    try {
      const res = await fetch("/api/ai/assistant/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, includePage, page: context, history: historyForServer, threadId: activeThreadId ?? undefined }),
      });
      if (!res.ok || !res.body) {
        try {
          const data: unknown = await res.json();
          const err = (typeof data === "object" && data !== null && "error" in data)
            ? String((data as { error?: unknown }).error ?? "")
            : "";
          throw new Error(`failed: ${res.status}${err ? ` - ${err}` : ""}`);
        } catch {
          throw new Error(`failed: ${res.status}`);
        }
      }
      // 新規スレッドが作成された場合に取得
      const tid = res.headers.get("X-Thread-Id");
      if (tid && (!activeThreadId || activeThreadId !== tid)) {
        setActiveThreadId(tid);
        void loadThreads();
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      while (!done) {
        const { value, done: d } = await reader.read();
        done = d;
        if (value) {
          const chunk = decoder.decode(value, { stream: !done });
          setMessages((s) => {
            const last = s[s.length - 1];
            if (!last || last.role !== "assistant") return s;
            const updated = { ...last, content: last.content + chunk };
            return [...s.slice(0, -1), updated];
          });
        }
      }
      // 完了後にサイドバーの一覧を更新
      void loadThreads();
      // flush any remaining decoder internal buffer
      const tail = decoder.decode();
      if (tail) {
        setMessages((s) => {
          const last = s[s.length - 1];
          if (!last || last.role !== "assistant") return s;
          const updated = { ...last, content: last.content + tail };
          return [...s.slice(0, -1), updated];
        });
      }
    } catch (e) {
      console.error(e);
      toast({ title: "チャット送信に失敗しました", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setLoading(false);
      sendingRef.current = false;
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // 日本語IMEなどの変換確定Enterは無視（重複送信防止）
    const isComposing = (e.nativeEvent as unknown as { isComposing?: boolean })?.isComposing === true;
    if (e.key === "Enter" && !e.shiftKey && !isComposing) {
      e.preventDefault();
      void send();
    }
  }

  if (!mounted) return null;
  return (
    <>
      {typeof document !== "undefined" && createPortal(
        <>
          <Button
            size="icon"
            // 物理座標を inline style で最優先に固定（環境依存の論理プロパティ/上書き回避）
            style={{
              position: "fixed",
              right: "max(16px, calc(env(safe-area-inset-right, 0px) + 16px))",
              bottom: "max(16px, calc(env(safe-area-inset-bottom, 0px) + 16px))",
              left: "auto",
              top: "auto",
              zIndex: 100,
              background: "linear-gradient(135deg, hsl(var(--primary-500)), hsl(var(--primary-600)))",
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
            className="rounded-full shadow-lg hover:shadow-xl hover:scale-110 active:scale-95"
            aria-label="AIチャットを開く"
            onClick={() => setOpen((v) => !v)}
          >
            <MessageCircle className="h-5 w-5" />
          </Button>
          {open && (
            <Card
              role="dialog"
              aria-modal={false}
              aria-label="AI チャット"
              className={cn(
                "fixed z-[110]",
                "flex flex-col left-auto top-auto",
                "shadow-2xl data-[dragging=true]:shadow-md",
                "border-0",
                "bg-background/90",
                // transform のアニメーションは外し、opacity のみ（初期の引っかかりを回避）
                "animate-in fade-in-0 duration-200"
              )}
              ref={cardRef}
              style={{ 
                right: pos.right, 
                bottom: pos.bottom, 
                width: size.w, 
                height: size.h,
                // 背景は半透明色で代替（backdrop-filter は描画コストが高いため削除）
                // 初期から合成レイヤを確保
                transform: "translateZ(0)",
                willChange: "transform",
                contain: "paint",
              }}
            >
          <CardHeader 
            className="py-3 select-none bg-gradient-to-r from-[hsl(var(--primary-50))] to-[hsl(var(--primary-100))] border-b cursor-grab data-[dragging=true]:cursor-grabbing"
            data-drag-region
            onPointerDown={(e) => {
              const target = e.target as HTMLElement | null;
              if (target && target.closest("[data-drag-ignore]")) return; // ignore interactive controls
              onDragMouseDown(e);
            }}
          >
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                aria-label="チャット履歴"
                className="mr-1"
                onClick={() => setSidebarOpen((v) => { const next = !v; if (next) void loadThreads(); return next; })}
                data-drag-ignore
              >
                <Menu className="h-4 w-4" />
              </Button>
              <div
                className="font-semibold flex-1 cursor-move flex items-center gap-2"
                data-drag-handle
                aria-label="ドラッグで移動"
                role="button"
              >
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                アシスタント
              </div>
              <Label htmlFor="use-page" className="text-xs" data-drag-ignore>ページ文脈</Label>
              <Switch id="use-page" data-drag-ignore checked={includePage} onCheckedChange={(v) => { setIncludePage(v); if (v) refresh(); }} />
              <Button 
                variant="ghost" 
                size="icon" 
                aria-label="閉じる" 
                onClick={() => setOpen(false)}
                className="hover:bg-[hsl(var(--primary-200))] transition-colors"
                data-drag-ignore
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <Separator />
          <CardContent className="p-0 flex-1 relative overflow-hidden">
            {loading && (
              <div className="absolute left-0 right-0 top-0 h-[2px] bg-gradient-to-r from-[hsl(var(--primary-400))] via-[hsl(var(--primary-500))] to-[hsl(var(--primary-400))] animate-pulse" />
            )}
            {sidebarOpen ? (
              <ResizablePanelGroup direction="horizontal" className="h-full">
                <ResizablePanel defaultSize={28} minSize={18} maxSize={42} collapsible collapsedSize={0} className="border-r">
                  <div className="h-full flex flex-col">
                    <div className="p-2 flex items-center justify-between border-b bg-muted/30">
                      <div className="text-xs font-medium">チャット履歴</div>
                      <Button size="sm" variant="outline" onClick={() => { setActiveThreadId(null); setMessages([]); }}>
                        <Plus className="h-3 w-3 mr-1" /> 新規
                      </Button>
                    </div>
                    <div className="p-2 text-xs text-muted-foreground">
                      {loadingThreads ? "読み込み中…" : threads.length === 0 ? "履歴はまだありません" : "最近のスレッド"}
                    </div>
                    <ScrollArea className="flex-1 px-2 pb-2">
                      <div className="space-y-1">
                        {threads.map((t) => (
                          <div key={t.id}
                               className={cn("group flex items-center gap-2 rounded-md border p-2 hover:bg-accent cursor-pointer", activeThreadId === t.id && "bg-accent")}
                               onClick={() => { setActiveThreadId(t.id); void loadMessages(t.id); }}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="truncate text-xs font-medium">{t.title || "無題のチャット"}</div>
                              <div className="truncate text-[10px] text-muted-foreground">{new Date((t as any).updatedAt ?? (t as any).createdAt).toLocaleString()}</div>
                            </div>
                            <Button variant="ghost" size="icon" aria-label="削除" className="opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); void deleteThread(t.id); }}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel>
                  <ScrollArea className="h-full p-3 pr-4">
                    <div ref={viewportRef} className="h-full overflow-y-auto pr-2">
                      {messages.length === 0 && (
                        <div className="text-xs text-muted-foreground p-4 text-center animate-in fade-in-50 duration-500">
                          <div className="mb-2">👋 こんにちは</div>
                          <div>質問を入力すると、このページの文脈を踏まえてお手伝いします。</div>
                        </div>
                      )}
                      {messages.map((m, i) => (
                        <div 
                          key={m.id} 
                          className={cn(
                            "mb-3 max-w-[88%] animate-in fade-in-0 slide-in-from-bottom-2 duration-300",
                            m.role === "user" ? "ml-auto text-right" : "mr-auto text-left"
                          )}
                          style={{ animationDelay: `${i * 50}ms` }}
                        >
                          <div 
                            className={cn(
                              "rounded-2xl px-4 py-2.5 text-xs whitespace-pre-wrap transition-all duration-200 hover:shadow-md",
                              m.role === "user" 
                                ? "bg-gradient-to-br from-[hsl(var(--primary-500))] to-[hsl(var(--primary-600))] text-white shadow-sm" 
                                : "bg-gradient-to-br from-[hsl(var(--muted))] to-[hsl(var(--accent))] text-[hsl(var(--foreground))] shadow-sm border border-[hsl(var(--border))]"
                            )}
                          >
                            {m.content || (
                              <div className="flex items-center gap-1">
                                <span className="inline-block w-2 h-2 rounded-full bg-current animate-bounce" style={{ animationDelay: "0ms" }} />
                                <span className="inline-block w-2 h-2 rounded-full bg-current animate-bounce" style={{ animationDelay: "150ms" }} />
                                <span className="inline-block w-2 h-2 rounded-full bg-current animate-bounce" style={{ animationDelay: "300ms" }} />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </ResizablePanel>
              </ResizablePanelGroup>
            ) : (
              <ScrollArea className="h-full p-3 pr-4">
                <div ref={viewportRef} className="h-full overflow-y-auto pr-2">
                  {messages.length === 0 && (
                    <div className="text-xs text-muted-foreground p-4 text-center animate-in fade-in-50 duration-500">
                      <div className="mb-2">👋 こんにちは</div>
                      <div>質問を入力すると、このページの文脈を踏まえてお手伝いします。</div>
                    </div>
                  )}
                  {messages.map((m, i) => (
                    <div 
                      key={m.id} 
                      className={cn(
                        "mb-3 max-w-[88%] animate-in fade-in-0 slide-in-from-bottom-2 duration-300",
                        m.role === "user" ? "ml-auto text-right" : "mr-auto text-left"
                      )}
                      style={{ animationDelay: `${i * 50}ms` }}
                    >
                      <div 
                        className={cn(
                          "rounded-2xl px-4 py-2.5 text-xs whitespace-pre-wrap transition-all duration-200 hover:shadow-md",
                          m.role === "user" 
                            ? "bg-gradient-to-br from-[hsl(var(--primary-500))] to-[hsl(var(--primary-600))] text-white shadow-sm" 
                            : "bg-gradient-to-br from-[hsl(var(--muted))] to-[hsl(var(--accent))] text-[hsl(var(--foreground))] shadow-sm border border-[hsl(var(--border))]"
                        )}
                      >
                        {m.content || (
                          <div className="flex items-center gap-1">
                            <span className="inline-block w-2 h-2 rounded-full bg-current animate-bounce" style={{ animationDelay: "0ms" }} />
                            <span className="inline-block w-2 h-2 rounded-full bg-current animate-bounce" style={{ animationDelay: "150ms" }} />
                            <span className="inline-block w-2 h-2 rounded-full bg-current animate-bounce" style={{ animationDelay: "300ms" }} />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
          <Separator />
          <CardFooter className="p-3 gap-2 bg-gradient-to-t from-[hsl(var(--background))] to-transparent">
            <Textarea
              placeholder="このページについて質問…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={2}
              className="resize-none transition-all duration-200 focus:shadow-lg focus:border-[hsl(var(--primary-400))]"
            />
            <Button
              onClick={() => void send()}
              disabled={loading || !input.trim()}
              size="icon"
              aria-label="送信"
              title="送信"
              className="bg-gradient-to-r from-[hsl(var(--primary-500))] to-[hsl(var(--primary-600))] hover:from-[hsl(var(--primary-600))] hover:to-[hsl(var(--primary-700))] transition-all duration-200 hover:shadow-lg disabled:opacity-50 h-9 w-9"
            >
              <Send className="h-4 w-4" />
            </Button>
          </CardFooter>
          {/* アクセシビリティ: ヒットターゲットを拡大しキーボード操作もサポート */}
          <div
            role="separator"
            aria-label="サイズ変更"
            aria-keyshortcuts="ArrowUp, ArrowDown, ArrowLeft, ArrowRight"
            tabIndex={0}
            onPointerDown={onResizeMouseDown}
            onKeyDown={(e) => {
              const step = e.shiftKey ? 32 : 16;
              let dw = 0, dh = 0;
              if (e.key === "ArrowRight") dw = step;
              else if (e.key === "ArrowLeft") dw = -step;
              else if (e.key === "ArrowDown") dh = step;
              else if (e.key === "ArrowUp") dh = -step;
              else return;
              e.preventDefault();
              const startW = sizeRef.current.w;
              const startH = sizeRef.current.h;
              const nextW = Math.min(560, Math.max(320, startW + dw));
              const nextH = Math.min(640, Math.max(280, startH + dh));
              const dW = nextW - startW;
              const dH = nextH - startH;
              const nextPos = clampPos(nextW, nextH, posRef.current.right - dW, posRef.current.bottom - dH);
              setSize({ w: nextW, h: nextH });
              setPos(nextPos);
            }}
            className="absolute right-0 bottom-0 p-3 cursor-se-resize opacity-60 hover:opacity-100 focus-visible:opacity-100 transition-opacity"
          >
            <div
              aria-hidden
              className="pointer-events-none h-3 w-3"
              style={{
                background: "linear-gradient(135deg, transparent 50%, hsl(var(--border)) 50%)",
              }}
            />
          </div>
            </Card>
          )}
        </>,
        document.body
      )}
    </>
  );
}

export default ChatWidget;
