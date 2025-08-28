"use client";
import * as React from "react";
import * as ToastPrimitives from "@radix-ui/react-toast";
import { cn } from "@/lib/utils/cn";

type ToastItem = { id?: string; title?: string; description?: string; variant?: "default" | "destructive" };

const listeners = new Set<(t: ToastItem) => void>();
export function toast(t: ToastItem) {
  listeners.forEach((fn) => fn(t));
}

export function Toaster() {
  const [items, setItems] = React.useState<(ToastItem & { id: string })[]>([]);
  React.useEffect(() => {
    const on = (t: ToastItem) => {
      const id = crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random()}`;
      setItems((s) => [...s, { id, ...t }]);
      // auto dismiss after 3.5s
      setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), 3500);
    };
    listeners.add(on);
    return () => void listeners.delete(on);
  }, []);

  return (
    <ToastPrimitives.Provider swipeDirection="right">
      {items.map((t) => (
        <ToastPrimitives.Root
          key={t.id}
          className={cn(
            "pointer-events-auto relative z-[100] m-2 w-80 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 shadow-lg",
            t.variant === "destructive" && "border-[hsl(var(--destructive))]/40"
          )}
          open
          onOpenChange={(open) => {
            if (!open) setItems((s) => s.filter((x) => x.id !== t.id));
          }}
        >
          {t.title && <div className="text-sm font-medium">{t.title}</div>}
          {t.description && <div className="text-xs text-gray-600 mt-1">{t.description}</div>}
        </ToastPrimitives.Root>
      ))}
      <ToastPrimitives.Viewport className="fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col-reverse p-2 sm:bottom-0 sm:right-0 sm:w-auto" />
    </ToastPrimitives.Provider>
  );
}

