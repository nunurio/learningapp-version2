"use client";
import { useEffect, useRef } from "react";

type Handlers = {
  onUpdate?: (data: any) => void;
  onDone?: (data: any) => void;
  onError?: (data: any) => void;
};

export function useSSE(
  url: string,
  body: Record<string, any>,
  { onUpdate, onDone, onError }: Handlers
) {
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Abort any in-flight request for prior effect
    try { abortRef.current?.abort(); } catch {}
    const ac = new AbortController();
    abortRef.current = ac;

    (async () => {
      const isAbortError = (err: any) =>
        err?.name === "AbortError" || err?.code === 20 || `${err?.message ?? ""}`.toLowerCase().includes("abort");

      try {
        const res = await fetch(url, {
          method: "POST",
          body: JSON.stringify(body),
          headers: { "Content-Type": "application/json" },
          signal: ac.signal,
        });
        if (ac.signal.aborted) return; // aborted early
        if (!res.body) return;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        try {
          while (!ac.signal.aborted) {
            const { done, value } = await reader.read();
            if (done || ac.signal.aborted) break;
            buf += decoder.decode(value, { stream: true });

            // SSE delimiter: \n\n
            let idx: number;
            while ((idx = buf.indexOf("\n\n")) !== -1) {
              const chunk = buf.slice(0, idx).trim();
              buf = buf.slice(idx + 2);

              // parse lines
              let event = "message";
              let data = "";
              for (const line of chunk.split("\n")) {
                if (line.startsWith("event:")) event = line.slice(6).trim();
                if (line.startsWith("data:")) data += line.slice(5).trim();
              }
              try {
                const json = data ? JSON.parse(data) : undefined;
                if (event === "update") onUpdate?.(json);
                else if (event === "done") onDone?.(json);
                else if (event === "error") onError?.(json);
              } catch {
                // ignore JSON parse errors
              }
            }
          }
        } catch (err) {
          if (!isAbortError(err)) onError?.({ message: (err as any)?.message ?? "stream error" });
        } finally {
          try { reader.releaseLock(); } catch {}
        }
      } catch (err) {
        if (!isAbortError(err)) onError?.({ message: (err as any)?.message ?? "request error" });
      }
    })();

    return () => {
      try { ac.abort(); } catch {}
    };
  }, [url, JSON.stringify(body)]);
}
