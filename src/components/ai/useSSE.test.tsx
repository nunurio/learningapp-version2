import React, { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { useSSE } from "./useSSE";

function sseStream(chunks: string[]) {
  const encoder = new TextEncoder();
  let i = 0;
  return {
    getReader: () => ({
      read: async () => {
        if (i < chunks.length) return { value: encoder.encode(chunks[i++]), done: false } as const;
        return { value: undefined, done: true } as const;
      },
      releaseLock: () => {},
    }),
  } as unknown as ReadableStream<Uint8Array>;
}

function TestComp() {
  const [updates, setUpdates] = useState<number>(0);
  const [done, setDone] = useState<string | null>(null);
  useSSE<{ ok: boolean }, { n: number }>(
    "/api/sse",
    { q: 1 },
    {
      onUpdate: (d) => setUpdates((n) => n + (d?.n ?? 0)),
      onDone: (d) => setDone(d?.ok ? "yes" : "no"),
      onError: () => setDone("err"),
    }
  );
  return (
    <div>
      <span data-testid="updates">{updates}</span>
      <span data-testid="done">{done ?? ""}</span>
    </div>
  );
}

describe("useSSE", () => {
  it("parses update and done SSE events", async () => {
    const body = [
      // split across chunks including Windows newlines
      "event: update\r\n",
      "data: {\"n\":1}\r\n\r\n",
      "event: update\n",
      "data: {\"n\":2}\n\n",
      "event: done\n",
      "data: {\"ok\":true}\n\n",
    ];
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      body: sseStream(body),
    } as unknown as Response);

    const { getByTestId } = render(<TestComp />);
    await waitFor(() => expect(getByTestId("updates").textContent).toBe("3"));
    await waitFor(() => expect(getByTestId("done").textContent).toBe("yes"));
  });

  it("reports error when body missing", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({ ok: true, status: 200, body: null } as unknown as Response);
    const { getByTestId } = render(<TestComp />);
    await waitFor(() => expect(getByTestId("done").textContent).toBe("err"));
  });
});

