import { z } from "zod";
import { NextResponse } from "next/server";
import { buildPageContextText, redactText, limitChars } from "@/lib/utils/redact";
import { parseJsonWithQuery } from "@/lib/utils/request";
import { initAgents } from "@/lib/ai/agents/index";
import { runChatAgent } from "@/lib/ai/agents/chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  message: z.string().min(1),
  includePage: z.boolean().optional().default(false),
  page: z
    .object({
      url: z.string().url().optional(),
      title: z.string().optional(),
      selection: z.string().nullable().optional(),
      headings: z.array(z.string()).nullable().optional(),
      contentSnippet: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});

function shouldUseMock() {
  return (
    process.env.AI_MOCK === "1" ||
    process.env.E2E === "1" ||
    process.env.PLAYWRIGHT_TEST === "1"
  );
}

async function* mockStream(message: string, pageText: string | null) {
  const base = `ご質問ありがとうございます。` +
    (pageText ? `提供されたページ文脈を踏まえて、` : "") +
    `要点を簡潔にお答えします。`;
  const tips = pageText
    ? `
【参照した文脈（要約）】\n${limitChars(pageText, 400)}`
    : "";
  const answer = `${base}\n\n- 質問: ${limitChars(message, 200)}\n- 回答方針: 箇条書きで手短に。${tips}\n\n1. 概要: ...\n2. 重要点: ...\n3. 次に試すこと: ...`;
  const words = answer.split(/(\s+)/);
  for (const w of words) {
    yield w;
    await new Promise((r) => setTimeout(r, 16));
  }
}

export async function POST(req: Request) {
  try {
    const input = await parseJsonWithQuery(req, RequestSchema);
    const pageText = input.includePage ? buildPageContextText(input.page ?? undefined) : null;
    const userText = limitChars(redactText(input.message ?? ""), 800);

    // Streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          if (shouldUseMock() || !process.env.OPENAI_API_KEY) {
            for await (const chunk of mockStream(userText, pageText)) controller.enqueue(encoder.encode(chunk));
            controller.close();
            return;
          }

          // Agents SDK（gpt-5既定）。現行SDKの簡便性を優先し、
          // 最終テキストを得て小刻みに分割してストリーム出力する。
          initAgents();
          const answer = await runChatAgent({ message: userText, pageText });
          const pieces = answer.split(/(\s+)/);
          for (const p of pieces) controller.enqueue(encoder.encode(p));
          controller.close();
        } catch (err) {
          try {
            controller.error(err);
          } catch {}
        }
      },
    });

    return new NextResponse(stream as unknown as ReadableStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : typeof e === "string" ? e : "invalid";
    return NextResponse.json({ error: message }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
