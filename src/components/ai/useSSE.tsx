"use client";
import { useEffect, useRef } from "react";

type DefaultUpdate = { node?: string; status?: string };

type Handlers<TDone, TUpdate = DefaultUpdate> = {
  onUpdate?: (data: TUpdate) => void;
  onDone?: (data: TDone) => void;
  onError?: (data: { message?: string }) => void;
};

export function useSSE<TDone, TUpdate = DefaultUpdate>(
  url: string,
  body: Record<string, unknown>,
  { onUpdate, onDone, onError }: Handlers<TDone, TUpdate>
) {
  const abortRef = useRef<AbortController | null>(null);
  const bodyKey = JSON.stringify(body);

  useEffect(() => {
    // Abort any in-flight request for prior effect
    try { abortRef.current?.abort(); } catch {}
    const ac = new AbortController();
    abortRef.current = ac;

    (async () => {
      const isAbortError = (err: unknown) => {
        const e = err as { name?: string; code?: number; message?: string } | undefined;
        const msg = (e?.message ?? "").toLowerCase();
        return e?.name === "AbortError" || e?.code === 20 || msg.includes("abort");
      };

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
                const json = (data ? JSON.parse(data) : undefined) as unknown;
                if (event === "update") onUpdate?.(json as TUpdate);
                else if (event === "done") { sawDone = true; onDone?.(json as TDone); }
                else if (event === "error") onError?.(json as { message?: string });
              } catch {
                // ignore JSON parse errors
              }
            }
          }
        } catch (err) {
          if (!isAbortError(err)) {
            const e = err as { message?: string } | undefined;
            onError?.({ message: e?.message ?? "stream error" });
          }
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
                const json = (data ? JSON.parse(data) : undefined) as unknown;
                if (event === "update") onUpdate?.(json as TUpdate);
                else if (event === "done") { sawDone = true; onDone?.(json as TDone); }
                else if (event === "error") onError?.(json as { message?: string });
              } catch {}
            }
          } catch {}
          if (!sawDone && !ac.signal.aborted) {
            onError?.({ message: "Stream ended without done" });
          }
        }
      } catch (err) {
        if (!isAbortError(err)) {
          const e = err as { message?: string } | undefined;
          onError?.({ message: e?.message ?? "request error" });
        }
      }
    })();

    return () => {
      try { ac.abort(); } catch {}
    };
  }, [url, body, bodyKey, onUpdate, onDone, onError]);
}
