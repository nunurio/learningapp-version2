import type { z } from "zod";

// 共通: Agents SDK の戻り値から構造化出力(JSON)を抽出
export function extractAgentJSON(res: unknown): unknown {
  if (res && typeof res === "object") {
    const rec = res as Record<string, unknown>;
    const a = rec.finalOutput as unknown;
    const b = rec.finalText as unknown;
    if (a && typeof a === "object") return a;
    if (typeof a === "string") {
      try { return JSON.parse(a) as unknown; } catch {}
    }
    if (typeof b === "string") {
      try { return JSON.parse(b) as unknown; } catch {}
    }
  }
  return undefined;
}

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
