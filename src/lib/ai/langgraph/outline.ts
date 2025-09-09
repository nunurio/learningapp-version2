import { Annotation, StateGraph } from "@langchain/langgraph";
import OpenAI from "openai";
import type { ResponseFormatTextJSONSchemaConfig } from "openai/resources/responses/responses";
import { CoursePlanSchema, CoursePlanJSONSchema, type CoursePlanOutput } from "@/lib/ai/schema";
import type { CoursePlan } from "@/lib/types";
import type { AiUpdate } from "@/lib/ai/log";

export type OutlineInput = {
  theme: string;
  level?: string;
  goal?: string;
  lessonCount?: number;
};

const OutlineState = Annotation.Root({
  input: Annotation<OutlineInput>(),
  plan: Annotation<CoursePlanOutput | undefined>(),
  // logs は reducer で配列結合（各ノードで追記）
  logs: Annotation<AiUpdate[]>({
    reducer: (left: AiUpdate[], right: AiUpdate[] | AiUpdate) => {
      const arr = Array.isArray(right) ? right : [right];
      return left.concat(arr);
    },
    default: () => [],
  }),
  error: Annotation<string | undefined>(),
});

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

function normalizeWhitespace(s: string | undefined): string | undefined {
  if (!s) return s;
  return s.replace(/\s+/g, " ").trim();
}

// Non-LLM: normalize inputs
async function normalizeInput(state: typeof OutlineState.State) {
  const i = state.input;
  const count = clamp(typeof i.lessonCount === "number" ? i.lessonCount : 6, 3, 30);
  const input = {
    theme: normalizeWhitespace(i.theme) ?? "コース",
    level: normalizeWhitespace(i.level),
    goal: normalizeWhitespace(i.goal),
    lessonCount: count,
  } satisfies OutlineInput;
  return { input, logs: [{ ts: Date.now(), text: "normalizeInput" }] };
}

// "Mock LLM" inside LangGraph to produce deterministic plan
function planFromMock(i: OutlineInput): CoursePlanOutput {
  const courseTitle = `${i.theme} 入門${i.level ? `（${i.level}）` : ""}`;
  const fallbackDescriptions = [
    "基礎から実践まで短期間で学べるコース",
    "最小限の理論と豊富な練習問題で身につける",
    "プロジェクト型で体系的に理解する",
  ];
  // pseudo-deterministic pick from fallbackDescriptions by hashing theme
  let idx = 0;
  for (let c = 0; c < i.theme.length; c++) idx = (idx + i.theme.charCodeAt(c)) % fallbackDescriptions.length;
  const desc = i.goal ? `${i.goal} を達成するためのコース` : fallbackDescriptions[idx];
  const lessons = Array.from({ length: i.lessonCount ?? 6 }, (_, k) => ({
    title: `${i.theme} 第${k + 1}回: 基礎トピック ${k + 1}`,
    summary: `コア概念とサンプルで ${i.theme} を理解する`,
  }));
  return {
    course: { title: courseTitle, description: desc, category: "General" },
    lessons,
  };
}

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

// LLM node（OpenAIが未設定ならモックでフォールバック）
async function planCourse(state: typeof OutlineState.State) {
  const i = state.input;
  const client = getClient();
  if (!client) throw new Error("OPENAI_API_KEY is not set");
  const model = process.env.OPENAI_MODEL ?? "gpt-5";
  const maxOut = process.env.OPENAI_MAX_OUTPUT_TOKENS ? Number(process.env.OPENAI_MAX_OUTPUT_TOKENS) : undefined;
  const sys = "あなたは教育設計の専門家です。出力はスキーマに厳格に従い、日本語で簡潔に書いてください。";
  const user = { theme: i.theme, level: i.level, goal: i.goal, lessonCount: i.lessonCount };
  const jsonFormat: ResponseFormatTextJSONSchemaConfig = {
    type: "json_schema",
    name: "CoursePlan",
    schema: CoursePlanJSONSchema as Record<string, unknown>,
    strict: true,
  };
  const res = await client.responses.create({
    model,
    input: [
      { role: "system", content: sys },
      { role: "user", content: `次の条件でコース案（レッスン${i.lessonCount}件）を作成してください。\n${JSON.stringify(user)}` },
    ],
    text: { format: jsonFormat },
    ...(maxOut ? { max_output_tokens: maxOut } : {}),
  });
  const planObj = extractJsonFromResponses(res);
  return { plan: planObj as CoursePlanOutput, logs: [{ ts: Date.now(), text: "planCourse" }] };
}

// no fallback path

// Validate with Zod
async function validatePlan(state: typeof OutlineState.State) {
  const parsed = CoursePlanSchema.safeParse(state.plan);
  if (!parsed.success) {
    const msg = parsed.error.issues
      .map((i) => `${i.path.map(String).join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`CoursePlan validation failed: ${msg}`);
  }
  return { plan: parsed.data, logs: [{ ts: Date.now(), text: "validatePlan" }] };
}

const outlineGraph = new StateGraph(OutlineState)
  .addNode("normalizeInput", normalizeInput)
  .addNode("planCourse", planCourse)
  .addNode("validatePlan", validatePlan)
  .addEdge("__start__", "normalizeInput")
  .addEdge("normalizeInput", "planCourse")
  .addEdge("planCourse", "validatePlan")
  .addEdge("validatePlan", "__end__");

const compiled = outlineGraph.compile();

export async function runOutlineGraph(input: OutlineInput): Promise<{ plan: CoursePlan; updates: AiUpdate[] }> {
  const start = Date.now();
  const res = await compiled.invoke({ input, logs: [{ ts: start, text: "received" }] });
  if (!res.plan) throw new Error("No plan generated");
  // persistPreview はAPIでは行わないが、UIのグルーピングのため最終ラベルを付与
  const updates: AiUpdate[] = [...(res.logs ?? []), { ts: Date.now(), text: "persistPreview" }];
  return { plan: res.plan as CoursePlan, updates };
}

function extractJsonFromResponses(r: OpenAI.Responses.Response): unknown {
  // Find first assistant message text and parse as JSON
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
