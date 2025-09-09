import { Annotation, StateGraph } from "@langchain/langgraph";
import OpenAI from "openai";
import type { ResponseFormatTextJSONSchemaConfig } from "openai/resources/responses/responses";
import { LessonCardsSchema, LessonCardsJSONSchema, type LessonCardsOutput } from "@/lib/ai/schema";
import type { LessonCards } from "@/lib/types";
import type { AiUpdate } from "@/lib/ai/log";

export type LessonCardsInput = {
  lessonTitle: string;
  desiredCount?: number;
  course?: {
    title: string;
    description?: string | null;
    category?: string | null;
  };
};

const CardsState = Annotation.Root({
  input: Annotation<LessonCardsInput>(),
  payload: Annotation<LessonCardsOutput | undefined>(),
  logs: Annotation<AiUpdate[]>({
    reducer: (left: AiUpdate[], right: AiUpdate[] | AiUpdate) => left.concat(Array.isArray(right) ? right : [right]),
    default: () => [],
  }),
});

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

function normalizeWhitespace(s: string | undefined): string | undefined {
  if (!s) return s;
  return s.replace(/\s+/g, " ").trim();
}

async function normalizeInput(state: typeof CardsState.State) {
  const i = state.input;
  const desired = clamp(typeof i.desiredCount === "number" ? i.desiredCount : 6, 3, 20);
  const input: LessonCardsInput = {
    lessonTitle: normalizeWhitespace(i.lessonTitle) ?? "レッスン",
    desiredCount: desired,
    course: i.course
      ? {
          title: normalizeWhitespace(i.course.title) ?? "",
          description: normalizeWhitespace(i.course.description ?? undefined) ?? null,
          category: normalizeWhitespace(i.course.category ?? undefined) ?? null,
        }
      : undefined,
  };
  return { input, logs: [{ ts: Date.now(), text: "normalizeInput" }] };
}

async function generateCards(state: typeof CardsState.State) {
  const i = state.input;
  const client = getClient();
  if (!client) throw new Error("OPENAI_API_KEY is not set");
  const model = process.env.OPENAI_MODEL ?? "gpt-5";
  const maxOut = process.env.OPENAI_MAX_OUTPUT_TOKENS ? Number(process.env.OPENAI_MAX_OUTPUT_TOKENS) : undefined;
  const sys = [
    "あなたは教育コンテンツ作成の専門家です。",
    "出力は JSON Schema（strict）に厳格に従い、日本語で簡潔に。",
    "カード構成は text / quiz / fill-blank をバランス良く含める（少なくとも fill-blank を1枚）。",
    "可能なら、与えられたコース概要（タイトル/説明/カテゴリ）に沿って語彙・例示・難易度を調整する。",
    "",
    "【fill-blank の厳守事項】",
    "- text: 本文中に [[1]], [[2]] ... の形式で穴埋めプレースホルダを入れる。",
    "- プレースホルダ番号は 1 から昇順で、本文に現れる番号ごとに answers に対応キーを用意する（余剰キー禁止）。",
    "- answers: { '1': '正解', '2': '正解' } のように、キーは文字列として数値、値は本文にそのまま差し込める正解文字列。",
    "- caseSensitive: デフォルトは false（コード/識別子など大文字小文字が意味を持つ場合のみ true）。",
    "- 本文は自然な日本語。空欄を示す下線や括弧は使わず、必ず [[n]] を使う。",
    "",
    "【quiz の注意】",
    "- options は少なくとも2件、answerIndex は 0 始まりで範囲内。explanation は簡潔に。",
    "",
    "【スキーマとの整合】",
    "- 使わないフィールドは null を設定してよい（例: text カードの question は null）。",
  ].join("\n");
  const user = { lessonTitle: i.lessonTitle, desiredCount: i.desiredCount, course: i.course };
  // 型安全のために JSON Schema フォーマットを明示の型に合わせて構築
  const jsonFormat: ResponseFormatTextJSONSchemaConfig = {
    type: "json_schema",
    name: "LessonCards",
    schema: LessonCardsJSONSchema as Record<string, unknown>,
    strict: true,
  };
  const res = await client.responses.create({
    model,
    input: [
      { role: "system", content: sys },
      { role: "user", content: `次のレッスン用にカードを${i.desiredCount}件、バランスよく生成してください。\n${JSON.stringify(user)}` },
    ],
    text: { format: jsonFormat },
    ...(maxOut ? { max_output_tokens: maxOut } : {}),
  });
  const payload = extractJsonFromResponses(res);
  return { payload: payload as LessonCardsOutput, logs: [{ ts: Date.now(), text: "generateCards" }] };
}

function validateFillBlank(payload: LessonCardsOutput) {
  for (const c of payload.cards) {
    if (c.type === "fill-blank") {
      const refs = new Set<string>();
      const re = /\[\[(\d+)\]\]/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(c.text)) != null) refs.add(m[1]);
      const keys = new Set(Object.keys(c.answers));
      for (const r of refs) if (!keys.has(r)) throw new Error(`fill-blank answers missing key: ${r}`);
    }
  }
}

async function validatePayload(state: typeof CardsState.State) {
  const parsed = LessonCardsSchema.safeParse(state.payload);
  if (!parsed.success) {
    const msg = parsed.error.issues
      .map((i) => `${i.path.map(String).join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`LessonCards validation failed: ${msg}`);
  }
  for (const c of parsed.data.cards) {
    if (c.type === "quiz") {
      if (!(c.answerIndex >= 0 && c.answerIndex < c.options.length)) {
        throw new Error("quiz.answerIndex out of range");
      }
    }
  }
  validateFillBlank(parsed.data);
  return { payload: parsed.data, logs: [{ ts: Date.now(), text: "validateSchema" }] };
}

const cardsGraph = new StateGraph(CardsState)
  .addNode("normalizeInput", normalizeInput)
  .addNode("generateCards", generateCards)
  .addNode("validatePayload", validatePayload)
  .addEdge("__start__", "normalizeInput")
  .addEdge("normalizeInput", "generateCards")
  .addEdge("generateCards", "validatePayload")
  .addEdge("validatePayload", "__end__");

const compiled = cardsGraph.compile();

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

function extractJsonFromResponses(r: OpenAI.Responses.Response): unknown {
  for (const item of r.output ?? []) {
    if (item.type === "message") {
      const msg = item as OpenAI.Responses.ResponseOutputMessage;
      for (const part of msg.content) {
        if (part.type === "output_text" && typeof part.text === "string") {
          try { return JSON.parse(part.text); } catch {}
        }
      }
    }
  }
  throw new Error("No JSON payload in Responses output");
}

export async function runLessonCardsGraph(input: LessonCardsInput): Promise<{ payload: LessonCards; updates: AiUpdate[] }> {
  const start = Date.now();
  const res = await compiled.invoke({ input, logs: [{ ts: start, text: "received" }] });
  if (!res.payload) throw new Error("No cards generated");
  const updates: AiUpdate[] = [...(res.logs ?? []), { ts: Date.now(), text: "persistPreview" }];
  return { payload: res.payload as LessonCards, updates };
}
