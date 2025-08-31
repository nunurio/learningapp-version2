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
        if (!res.ok) {
          onError?.({ message: `HTTP ${res.status} ${res.statusText}` });
          return;
        }
        if (!res.body) {
          onError?.({ message: "No response body" });
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let sawDone = false;
        try {
          while (!ac.signal.aborted) {
            const { done, value } = await reader.read();
            if (done || ac.signal.aborted) break;
            buf += decoder.decode(value, { stream: true });

            // SSE delimiter: blank line (\n\n or \r\n\r\n)
            const findDelimiter = () => {
              const nn = buf.indexOf("\n\n");
              const rr = buf.indexOf("\r\n\r\n");
              if (nn === -1) return rr;
              if (rr === -1) return nn;
              return Math.min(nn, rr);
            };
            let idx: number;
            while ((idx = findDelimiter()) !== -1) {
              const chunk = buf.slice(0, idx);
              // advance by the delimiter length (2 for \n\n, 4 for \r\n\r\n)
              const advance = buf.slice(idx, idx + 4) === "\r\n\r\n" ? 4 : 2;
              buf = buf.slice(idx + advance);

              // parse lines
              let event = "message";
              let data = "";
              for (const raw of chunk.split(/\r?\n/)) {
                const line = raw.trimEnd();
                if (line.startsWith("event:")) event = line.slice(6).trim();
                if (line.startsWith("data:")) data += line.slice(5).trim();
              }
              try {
                const json = data ? JSON.parse(data) : undefined;
                if (event === "update") onUpdate?.(json);
                else if (event === "done") { sawDone = true; onDone?.(json); }
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
          // flush any remaining decoded text and parse once more
          try {
            buf += decoder.decode();
            // best-effort: parse last chunk without requiring trailing delimiter
            const chunks = buf.split(/\n\n|\r\n\r\n/);
            for (const chunk of chunks) {
              if (!chunk.trim()) continue;
              let event = "message";
              let data = "";
              for (const raw of chunk.split(/\r?\n/)) {
                const line = raw.trimEnd();
                if (line.startsWith("event:")) event = line.slice(6).trim();
                if (line.startsWith("data:")) data += line.slice(5).trim();
              }
              try {
                const json = data ? JSON.parse(data) : undefined;
                if (event === "update") onUpdate?.(json);
                else if (event === "done") { sawDone = true; onDone?.(json); }
                else if (event === "error") onError?.(json);
              } catch {}
            }
          } catch {}
          if (!sawDone && !ac.signal.aborted) {
            onError?.({ message: "Stream ended without done" });
          }
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
