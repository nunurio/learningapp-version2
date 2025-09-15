import { Agent, extractAllTextOutput } from "@openai/agents";
import type { UnknownContext } from "@openai/agents";
import { runner } from "@/lib/ai/agents/index";
import { JA_BASE_STYLE } from "@/lib/ai/prompts";

const CHAT_INSTRUCTIONS = `
あなたは学習アプリに常駐するアシスタントです。
${JA_BASE_STYLE}

# 役割
- ユーザーの質問に対し、箇条書き中心で手短に具体的に答える。
- 不足情報がある場合は仮定を明示し、確認事項を列挙する。
- ページ文脈が与えられた場合は参考にするが、丸写しは避け要約して統合する。

# 出力
- 通常は **プレーンテキスト**（Markdown可）。
- 事実不明時はその旨を明示し推測で断定しない。
`.trim();

export const ChatAgent = new Agent<UnknownContext>({
  name: "Site Assistant",
  instructions: CHAT_INSTRUCTIONS,
  model: process.env.OPENAI_MODEL, // 既定は runner 側で gpt-5
});

export async function runChatAgent(input: {
  message: string;
  pageText?: string | null;
  history?: { role: "user" | "assistant"; content: string }[];
}): Promise<string> {
  const payload = {
    task: "Answer the user question as helpful assistant.",
    parameters: {
      message: input.message,
      pageContext: input.pageText ?? null,
      history: Array.isArray(input.history) ? input.history.slice(-10) : null,
    },
  } as const;

  const res = await runner.run(ChatAgent, JSON.stringify(payload), { maxTurns: 1 });
  // Agents SDK の履歴からテキスト出力を抽出
  const text = extractAllTextOutput((res.history ?? []) as never[]);
  if (typeof text === "string" && text.trim()) return text;
  // 念のため最終出力に文字列があればそれを使う
  if (res.finalOutput && typeof res.finalOutput === "string") return String(res.finalOutput);
  throw new Error("No agent text output");
}
