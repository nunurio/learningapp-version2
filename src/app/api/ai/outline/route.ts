import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Update = { event: "update" | "done" | "error"; data?: any };

function sseEncode(msg: Update) {
  const lines = [`event: ${msg.event}`];
  if (msg.data !== undefined) lines.push(`data: ${JSON.stringify(msg.data)}`);
  // SSE requires one blank line between events
  return lines.join("\n") + "\n\n";
}

function generatePlan(params: {
  theme: string;
  level?: string;
  goal?: string;
  lessonCount?: number;
}) {
  const count = Math.min(Math.max(params.lessonCount ?? 6, 3), 30);
  const courseTitle = `${params.theme.trim()} 入門${params.level ? `（${params.level}）` : ""}`;
  const describe = params.goal?.trim()
    ? `${params.goal.trim()} を達成するためのコース`
    : "基礎から実践まで短期間で学べるコース";
  return {
    course: { title: courseTitle, description: describe, category: "General" },
    lessons: Array.from({ length: count }, (_, i) => ({
      title: `${params.theme.trim()} 第${i + 1}回: 基礎トピック ${i + 1}`,
      summary: `${params.theme.trim()} のポイントを理解する`,
    })),
  };
}

export async function POST(req: NextRequest) {
  // 入力の堅牢化（JSONが空/壊れていてもフォールバック）
  let theme: string | undefined;
  let level: string | undefined;
  let goal: string | undefined;
  let lessonCount: number | undefined;
  try {
    if (req.headers.get("content-type")?.includes("application/json")) {
      const j = await req.json().catch(() => ({} as any));
      theme = j?.theme ?? undefined;
      level = j?.level ?? undefined;
      goal = j?.goal ?? undefined;
      lessonCount = typeof j?.lessonCount === "number" ? j.lessonCount : undefined;
    }
  } catch {}
  try {
    const url = new URL(req.url);
    theme = theme ?? url.searchParams.get("theme") ?? undefined;
    level = level ?? url.searchParams.get("level") ?? undefined;
    goal = goal ?? url.searchParams.get("goal") ?? undefined;
    const lc = url.searchParams.get("lessonCount");
    if (lc != null) lessonCount = Number(lc);
  } catch {}
  if (!theme || typeof theme !== "string") theme = "コース";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (msg: Update) => controller.enqueue(enc.encode(sseEncode(msg)));

      send({ event: "update", data: { status: "received" } });
      try {
        const steps = [
          { node: "normalizeInput" },
          { node: "planCourse" },
          { node: "validatePlan" },
          { node: "persistPreview" },
        ];

        for (const s of steps) {
          await new Promise((r) => setTimeout(r, 300));
          send({ event: "update", data: s });
        }

        const plan = generatePlan({ theme, level, goal, lessonCount });
        await new Promise((r) => setTimeout(r, 200));
        send({ event: "done", data: { plan, draftId: "local-client-will-save" } });
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
