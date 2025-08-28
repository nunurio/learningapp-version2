import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Update = { event: "update" | "done" | "error"; data?: any };

function sseEncode(msg: Update) {
  const lines = [`event: ${msg.event}`];
  if (msg.data !== undefined) lines.push(`data: ${JSON.stringify(msg.data)}`);
  lines.push("", "");
  return lines.join("\n");
}

function generateCards(params: { lessonTitle: string; desiredCount?: number }) {
  const count = Math.min(Math.max(params.desiredCount ?? 6, 3), 20);
  const cards: any[] = [];
  for (let i = 0; i < count; i++) {
    if (i % 3 === 0) {
      cards.push({ type: "text", title: `解説 ${i + 1}`, body: `${params.lessonTitle} のポイント ${i + 1} を解説。` });
    } else if (i % 3 === 1) {
      cards.push({
        type: "quiz",
        title: `クイズ ${i + 1}`,
        question: `${params.lessonTitle} に関する基本問題 ${i + 1}`,
        options: ["A", "B", "C", "D"],
        answerIndex: (i + 1) % 4,
        explanation: "正解の理由を簡潔に説明。",
      });
    } else {
      cards.push({
        type: "fill-blank",
        title: `穴埋め ${i + 1}`,
        text: `${params.lessonTitle} のキーワードは [[1]] です。`,
        answers: { "1": "キーワード" },
        caseSensitive: false,
      });
    }
  }
  return { lessonTitle: params.lessonTitle, cards };
}

export async function POST(req: NextRequest) {
  const { lessonTitle, desiredCount } = await req.json();

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

        const payload = generateCards({ lessonTitle, desiredCount });
        await new Promise((r) => setTimeout(r, 200));
        send({ event: "done", data: { payload, draftId: "local-client-will-save" } });
      } catch (e: any) {
        send({ event: "error", data: { message: e?.message ?? "unknown" } });
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

