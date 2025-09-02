import type { NextRequest } from "next/server";
import { generateLessonCards } from "@/lib/ai/mock";
import type { LessonCards } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Update = { event: "update" | "done" | "error"; data?: unknown };

function sseEncode(msg: Update) {
  const lines = [`event: ${msg.event}`];
  if (msg.data !== undefined) lines.push(`data: ${JSON.stringify(msg.data)}`);
  // SSE requires a blank line between events -> terminate with \n\n
  return lines.join("\n") + "\n\n";
}

// 生成処理は lib/ai/mock に集約

export async function POST(req: NextRequest) {
  // 入力の堅牢化: JSON が空/壊れていても動くようにフォールバック
  let lessonTitle: string | undefined;
  let desiredCount: number | undefined;
  try {
    if (req.headers.get("content-type")?.includes("application/json")) {
      const j = (await req.json().catch(() => ({}))) as Partial<{ lessonTitle: string; desiredCount: number }>;
      lessonTitle = j.lessonTitle ?? undefined;
      desiredCount = typeof j.desiredCount === "number" ? j.desiredCount : undefined;
    }
  } catch {}
  try {
    const url = new URL(req.url);
    lessonTitle = lessonTitle ?? url.searchParams.get("lessonTitle") ?? undefined;
    const dc = url.searchParams.get("desiredCount");
    if (dc != null) desiredCount = Number(dc);
  } catch {}
  if (!lessonTitle || typeof lessonTitle !== "string") lessonTitle = "レッスン";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (msg: Update) => controller.enqueue(enc.encode(sseEncode(msg)));

      send({ event: "update", data: { status: "received" } });
      try {
        const steps = [
          { node: "expandContext" },
          { node: "generateCards" },
          { node: "validateSchema" },
          { node: "persistPreview" },
        ];

        for (const s of steps) {
          await new Promise((r) => setTimeout(r, 250));
          send({ event: "update", data: s });
        }

        const payload: LessonCards = generateLessonCards({ lessonTitle, desiredCount });
        await new Promise((r) => setTimeout(r, 200));
        send({ event: "done", data: { payload, draftId: "local-client-will-save" } });
      } catch (e: unknown) {
        const err = e as { message?: string } | undefined;
        send({ event: "error", data: { message: err?.message ?? "unknown" } });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
