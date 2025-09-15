import { Agent, extractAllTextOutput, user, assistant as assistantMsg, system } from "@openai/agents";
import type { UnknownContext } from "@openai/agents";
import { runner } from "@/lib/ai/agents/index";
import { JA_BASE_STYLE } from "@/lib/ai/prompts";

export const CHAT_INSTRUCTIONS = `
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

// 型定義未追従環境でも余剰キーのリテラルチェックを回避するため、
// いったん緩いオブジェクトに格納してから渡す（anyは使わない）
const chatModelSettings: {} = { reasoning: { effort: "minimal" } };

export const ChatAgent = new Agent<UnknownContext>({
  name: "Site Assistant",
  instructions: CHAT_INSTRUCTIONS,
});

export async function runChatAgent(input: {
  message: string;
  pageText?: string | null;
  history?: { role: "user" | "assistant"; content: string }[];
}): Promise<string> {
  // Items 化してRunnerへ（履歴→system(page)→user）
  const items: Array<ReturnType<typeof user> | ReturnType<typeof assistantMsg> | ReturnType<typeof system>> = [];
  if (Array.isArray(input.history)) {
    for (const m of input.history.slice(-10)) {
      items.push(m.role === "user" ? user(m.content) : assistantMsg(m.content));
    }
  }
  if (input.pageText) items.push(system(input.pageText));
  items.push(user(input.message));

  const res = await runner.run(ChatAgent, items, { maxTurns: 1 });
  // Agents SDK の履歴からテキスト出力を抽出
  const text = extractAllTextOutput((res.history ?? []) as never[]);
  if (typeof text === "string" && text.trim()) return text;
  // 念のため最終出力に文字列があればそれを使う
  if (res.finalOutput && typeof res.finalOutput === "string") return String(res.finalOutput);
  throw new Error("No agent text output");
}
