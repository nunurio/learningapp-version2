"use client";
import { useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";

export function SSEConsole({ logs }: { logs: { ts: number; text: string }[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" });
  }, [logs.length]);

  return (
    <Card ref={ref} className="p-3 text-xs text-gray-700 h-64 overflow-auto" role="status" aria-live="polite">
      {logs.length === 0 ? (
        <p className="text-gray-500">ログはまだありません。</p>
      ) : (
        <ul className="space-y-1">
          {logs.map((l, i) => (
            <li key={i} className="font-mono">
              <span className="text-gray-500">{new Date(l.ts).toLocaleTimeString()} ▸ </span>
              <span>{l.text}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
