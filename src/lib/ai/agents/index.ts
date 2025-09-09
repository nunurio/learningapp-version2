import { Runner, setDefaultOpenAIKey } from "@openai/agents";

// Initialize a reusable Runner with project defaults
export const runner = new Runner({
  model: process.env.OPENAI_MODEL || "gpt-5",
  modelSettings: {
    maxTokens: process.env.OPENAI_MAX_OUTPUT_TOKENS
      ? Number(process.env.OPENAI_MAX_OUTPUT_TOKENS)
      : undefined,
  },
  workflowName: "Course authoring",
  traceIncludeSensitiveData: false,
});

export function initAgents() {
  // Configure API key for Agents SDK if present
  if (process.env.OPENAI_API_KEY) setDefaultOpenAIKey(process.env.OPENAI_API_KEY);
}
