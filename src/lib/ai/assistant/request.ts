import { z } from "zod";
import { buildPageContextText, limitChars, redactText } from "@/lib/utils/redact";
import { parseJsonWithQuery } from "@/lib/utils/request";
import {
  ActiveRefSchema,
  type ActiveRef,
} from "@/lib/ai/tools/context-tools";
import type { ChatHistoryEntry } from "@/lib/ai/agents/chat";

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
      activeRef: ActiveRefSchema.optional(),
    })
    .nullable()
    .optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1),
      })
    )
    .max(50)
    .optional(),
  threadId: z.string().uuid().optional(),
  activeRef: ActiveRefSchema.optional(),
});

export type AssistantRequestPayload = {
  userText: string;
  pageText: string | null;
  history: ChatHistoryEntry[];
  requestedThreadId?: string;
  activeRef?: ActiveRef;
};

export async function parseAssistantRequest(req: Request): Promise<AssistantRequestPayload> {
  const input = await parseJsonWithQuery(req, RequestSchema);
  const pageText = input.includePage ? buildPageContextText(input.page ?? undefined) : null;
  const userText = limitChars(redactText(input.message ?? ""), 800);

  const history: ChatHistoryEntry[] = Array.isArray(input.history)
    ? input.history
        .filter((message) => message && typeof message.content === "string" && message.content.trim().length > 0)
        .slice(-12)
        .map((message) => ({ role: message.role, content: limitChars(redactText(message.content), 800) }))
    : [];

  const rawActiveRef = input.activeRef ?? input.page?.activeRef ?? undefined;
  const parsedActiveRef = rawActiveRef ? ActiveRefSchema.safeParse(rawActiveRef) : null;

  return {
    userText,
    pageText,
    history,
    requestedThreadId: input.threadId ?? undefined,
    activeRef: parsedActiveRef?.success ? parsedActiveRef.data : undefined,
  };
}
