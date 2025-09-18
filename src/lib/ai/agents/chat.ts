import { Agent, extractAllTextOutput, user, assistant as assistantMsg, system } from "@openai/agents";
import { runner } from "@/lib/ai/agents/index";
import { CHAT_AGENT_INSTRUCTIONS } from "@/lib/ai/prompts";

export type ChatAgentContext = Record<string, never>;
export type ChatHistoryEntry = { role: "user" | "assistant"; content: string };

export function createChatAgent() {
  return new Agent<ChatAgentContext>({
    name: "Site Assistant",
    instructions: CHAT_AGENT_INSTRUCTIONS,
    modelSettings: {
      providerData: {
        reasoning: { effort: "low" },
        text: { verbosity: "low" },
      },
    },
  });
}

export const ChatAgent = createChatAgent();

export function buildChatItems(options: {
  history?: ChatHistoryEntry[] | null;
  message: string;
  pageText?: string | null;
  historyLimit?: number;
}) {
  const { history, message, pageText, historyLimit = 10 } = options;
  const items: Array<ReturnType<typeof user> | ReturnType<typeof assistantMsg> | ReturnType<typeof system>> = [];
  if (Array.isArray(history) && history.length > 0) {
    const start = historyLimit ? -Math.abs(historyLimit) : undefined;
    for (const entry of history.slice(start)) {
      items.push(entry.role === "user" ? user(entry.content) : assistantMsg(entry.content));
    }
  }
  if (pageText) items.push(system(pageText));
  items.push(user(message));
  return items;
}

export async function runChatAgent(input: {
  message: string;
  pageText?: string | null;
  history?: ChatHistoryEntry[];
}): Promise<string> {
  const items = buildChatItems({
    history: input.history,
    message: input.message,
    pageText: input.pageText,
    historyLimit: 10,
  });

  const res = await runner.run(ChatAgent, items, { maxTurns: 1 });
  // Agents SDK の履歴からテキスト出力を抽出
  const text = extractAllTextOutput((res.history ?? []) as never[]);
  if (typeof text === "string" && text.trim()) return text;
  // 念のため最終出力に文字列があればそれを使う
  if (res.finalOutput && typeof res.finalOutput === "string") return String(res.finalOutput);
  throw new Error("No agent text output");
}
