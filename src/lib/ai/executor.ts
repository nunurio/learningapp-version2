import type { z } from "zod";
// RunResult 型に依存せず最小の構造だけ扱う（ESLint:no-explicit-any 対策）
import { extractAllTextOutput } from "@openai/agents";

// 共通: Zod スキーマで厳密検証（エラーメッセージを簡潔整形）
export function parseWithSchema<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = first?.path?.length ? ` at ${first.path.join('.')}` : "";
    throw new Error(`${first?.message ?? "schema mismatch"}${path}`);
  }
  return parsed.data;
}

// フォールバック: 実行履歴からテキストを抽出し、JSON→Zod検証で構造化を試みる
type HistoryLike = { history?: unknown[] };
export function fallbackFromHistory<T>(res: HistoryLike, schema: z.ZodSchema<T>): T | undefined {
  const items = (res?.history ?? []) as unknown[];
  if (!Array.isArray(items) || items.length === 0) return undefined;
  const text = extractAllTextOutput(items as never[]);
  if (typeof text !== "string" || !text.trim()) return undefined;
  try {
    const parsed: unknown = JSON.parse(text);
    return schema.parse(parsed);
  } catch {
    return undefined;
  }
}
