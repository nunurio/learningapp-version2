import { beforeEach, describe, expect, it, vi } from "vitest";

type MockFn = ReturnType<typeof vi.fn>;

type AgentConfig = {
  name?: string;
  instructions?: string;
  modelSettings?: {
    providerData?: {
      reasoning?: { effort?: string };
      text?: { verbosity?: string };
    };
  };
};

function isAgentConfig(value: unknown): value is AgentConfig {
  return typeof value === "object" && value !== null;
}

vi.mock("@openai/agents", () => {
  const runMock = vi.fn();
  class Runner {
    run: MockFn;
    constructor() {
      this.run = runMock;
    }
  }
  const Agent = vi.fn(function AgentMock(this: { config: unknown }, config: unknown) {
    this.config = config;
  });
  const user = vi.fn((content: string) => ({ role: "user", content }));
  const assistant = vi.fn((content: string) => ({ role: "assistant", content }));
  const system = vi.fn((content: string) => ({ role: "system", content }));
  const extractAllTextOutput = vi.fn();
  const setDefaultOpenAIKey = vi.fn();
  return {
    Agent,
    Runner,
    user,
    assistant,
    system,
    extractAllTextOutput,
    setDefaultOpenAIKey,
  };
});

import {
  buildChatItems,
  ChatAgent,
  createChatAgent,
  runChatAgent,
  type ChatHistoryEntry,
} from "@/lib/ai/agents/chat";
import { runner } from "@/lib/ai/agents/index";
import { Agent, extractAllTextOutput } from "@openai/agents";
import { CHAT_AGENT_INSTRUCTIONS } from "@/lib/ai/prompts";

const runnerRunMock = runner.run as unknown as MockFn;

beforeEach(() => {
  runnerRunMock.mockReset();
  vi.mocked(extractAllTextOutput).mockReset();
  vi.mocked(Agent).mockClear();
});

describe("buildChatItems", () => {
  it("trims history to the limit, injects page text as system, and appends the new user message", () => {
    const history: ChatHistoryEntry[] = [
      { role: "user", content: "first" },
      { role: "assistant", content: "second" },
      { role: "user", content: "third" },
    ];

    const items = buildChatItems({
      history,
      historyLimit: 2,
      message: "current-question",
      pageText: "contextual information",
    });

    expect(items).toEqual([
      { role: "assistant", content: "second" },
      { role: "user", content: "third" },
      { role: "system", content: "contextual information" },
      { role: "user", content: "current-question" },
    ]);
  });

  it("skips undefined history and page text inputs", () => {
    const items = buildChatItems({ history: undefined, message: "just me" });
    expect(items).toEqual([{ role: "user", content: "just me" }]);
  });
});

describe("createChatAgent", () => {
  it("passes the expected configuration to the Agent constructor", () => {
    createChatAgent();
    const AgentMock = vi.mocked(Agent);
    expect(AgentMock).toHaveBeenCalledTimes(1);
    const [config] = AgentMock.mock.calls[0] ?? [];
    expect(isAgentConfig(config)).toBe(true);
    if (!isAgentConfig(config)) return;
    expect(config.name).toBe("Site Assistant");
    expect(config.instructions).toBe(CHAT_AGENT_INSTRUCTIONS);
    expect(config.modelSettings?.providerData?.reasoning?.effort).toBe("low");
    expect(config.modelSettings?.providerData?.text?.verbosity).toBe("low");
  });
});

describe("runChatAgent", () => {
  it("returns text extracted from the agent history", async () => {
    const history: ChatHistoryEntry[] = [{ role: "user", content: "previous question" }];
    const expected = "assistant answer";

    runnerRunMock.mockResolvedValue({ history: [expected], finalOutput: null });
    vi.mocked(extractAllTextOutput).mockReturnValue(expected);

    const result = await runChatAgent({ message: "latest", history });

    expect(result).toBe(expected);
    expect(runnerRunMock).toHaveBeenCalledWith(
      ChatAgent,
      [
        { role: "user", content: "previous question" },
        { role: "user", content: "latest" },
      ],
      { maxTurns: 1 },
    );
  });

  it("falls back to finalOutput when no history text is available", async () => {
    const fallback = "finalized text";
    runnerRunMock.mockResolvedValue({ history: [], finalOutput: fallback });
    vi.mocked(extractAllTextOutput).mockReturnValue("   ");

    await expect(runChatAgent({ message: "ping" })).resolves.toBe(fallback);
  });

  it("throws when the agent produces no textual response", async () => {
    runnerRunMock.mockResolvedValue({ history: [], finalOutput: undefined });
    vi.mocked(extractAllTextOutput).mockReturnValue(" ");

    await expect(runChatAgent({ message: "ping" })).rejects.toThrowError("No agent text output");
  });
});
