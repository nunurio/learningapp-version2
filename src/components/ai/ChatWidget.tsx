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
import { Progress } from "@/components/ui/progress";
import { toast } from "@/components/ui/toaster";
import { MessageCircle, X } from "lucide-react";
import { usePageContext } from "@/components/ai/use-page-context";
import { uid } from "@/lib/utils/uid";
import { cn } from "@/lib/utils/cn";

type Msg = { id: string; role: "user" | "assistant"; content: string };

export function ChatWidget() {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const [open, setOpen] = React.useState(false);
  const [includePage, setIncludePage] = React.useState(true);
  const [messages, setMessages] = React.useState<Msg[]>([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const { context, refresh } = usePageContext();
  const viewportRef = React.useRef<HTMLDivElement>(null);

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

  const onDragMouseDown = (e: React.PointerEvent) => {
    const startX = e.clientX;
    const startY = e.clientY;
    const startPos = { ...pos };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const next = clampPos(size.w, size.h, startPos.right - dx, startPos.bottom - dy);
      setPos(next);
    };
    const onUp = (ev: PointerEvent) => {
      try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const onResizeMouseDown = (e: React.PointerEvent) => {
    const startX = e.clientX;
    const startY = e.clientY;
    const startSize = { ...size };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const w = Math.min(560, Math.max(320, startSize.w + dx));
      const h = Math.min(640, Math.max(280, startSize.h + dy));
      setSize({ w, h });
      // サイズ変更で画面外に出ないよう位置も補正
      setPos((p) => clampPos(w, h, p.right, p.bottom));
    };
    const onUp = (_ev: PointerEvent) => {
      try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  async function send() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    setLoading(true);
    setMessages((s) => [...s, { id: uid(), role: "user", content: text }, { id: uid(), role: "assistant", content: "" }]);
    try {
      const res = await fetch("/api/ai/assistant/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, includePage, page: context }),
      });
      if (!res.ok || !res.body) {
        try {
          const data = await res.json();
          throw new Error(`failed: ${res.status}${data?.error ? ` - ${data.error}` : ""}`);
        } catch {
          throw new Error(`failed: ${res.status}`);
        }
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      while (!done) {
        const { value, done: d } = await reader.read();
        done = d;
        if (value) {
          const chunk = decoder.decode(value);
          setMessages((s) => {
            const last = s[s.length - 1];
            if (!last || last.role !== "assistant") return s;
            const updated = { ...last, content: last.content + chunk };
            return [...s.slice(0, -1), updated];
          });
        }
      }
    } catch (e) {
      console.error(e);
      toast({ title: "チャット送信に失敗しました", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
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
            }}
            className="rounded-full shadow-lg"
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
              className={cn("fixed z-[110]", "flex flex-col left-auto top-auto")}
              style={{ right: pos.right, bottom: pos.bottom, width: size.w, height: size.h }}
            >
          <CardHeader className="py-3 select-none">
            <div className="flex items-center gap-2">
              <div
                className="font-semibold flex-1 cursor-move"
                data-drag-handle
                onPointerDown={onDragMouseDown}
                aria-label="ドラッグで移動"
                role="button"
              >
                アシスタント
              </div>
              <Label htmlFor="use-page" className="text-xs">ページ文脈</Label>
              <Switch id="use-page" checked={includePage} onCheckedChange={(v) => { setIncludePage(v); if (v) refresh(); }} />
              <Button variant="ghost" size="icon" aria-label="閉じる" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <Separator />
          <CardContent className="p-0 flex-1 relative">
            {loading && <Progress className="absolute left-0 right-0 top-0 h-[2px]" value={65} />}
            <ScrollArea className="h-full p-3 pr-4">
              <div ref={viewportRef} className="h-full overflow-y-auto pr-2">
                {messages.length === 0 && (
                  <div className="text-xs text-muted-foreground p-2">
                    こんにちは。質問を入力すると、このページの文脈を踏まえてお手伝いします。
                  </div>
                )}
                {messages.map((m) => (
                  <div key={m.id} className={cn("mb-3 max-w-[88%]", m.role === "user" ? "ml-auto text-right" : "mr-auto text-left") }>
                    <div className={cn("rounded-md px-3 py-2 text-xs whitespace-pre-wrap", m.role === "user" ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]" : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]")}>{m.content}</div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
          <Separator />
          <CardFooter className="p-3 gap-2">
            <Textarea
              placeholder="このページについて質問…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={2}
            />
            <Button onClick={() => void send()} disabled={loading || !input.trim()}>送信</Button>
          </CardFooter>
          <div
            role="separator"
            aria-label="resize"
            onPointerDown={onResizeMouseDown}
            className="absolute right-1 bottom-1 h-3 w-3 cursor-se-resize"
          />
            </Card>
          )}
        </>,
        document.body
      )}
    </>
  );
}

export default ChatWidget;
