import type { z } from "zod";

// Body(JSON) と QueryString をマージして Zod で検証する軽量ヘルパー
export async function parseJsonWithQuery<T>(req: Request, schema: z.ZodSchema<T>, defaults?: Partial<T>): Promise<T> {
  let body: Record<string, unknown> = {};
  try {
    if (req.headers.get("content-type")?.includes("application/json")) {
      const j: unknown = await req.json();
      if (j && typeof j === "object" && !Array.isArray(j)) body = j as Record<string, unknown>;
    }
  } catch {
    // ignore body parse errors and fall back to query only
  }
  // QueryString を浅くオブジェクト化（数値は数値へ、true/false を boolean へ）
  let query: Record<string, unknown> = {};
  try {
    const url = new URL(req.url);
    url.searchParams.forEach((v, k) => {
      if (v === "true") query[k] = true;
      else if (v === "false") query[k] = false;
      else if (v !== "" && !Number.isNaN(Number(v)) && /^-?\d+(\.\d+)?$/.test(v)) query[k] = Number(v);
      else query[k] = v;
    });
  } catch {
    // ignore
  }
  // defaults が未指定(undefined/null)でもクラッシュしないように空オブジェクトへフォールバック
  const base = (defaults ?? {}) as object;
  const merged = { ...base, ...query, ...body } as unknown;
  const parsed = schema.safeParse(merged);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = first?.path?.length ? ` at ${first.path.join('.')}` : "";
    throw new Error(`${first?.message ?? "invalid request"}${path}`);
  }
  return parsed.data;
}
