import type { Database, TablesInsert } from "@/lib/database.types";

export type TableName = keyof Database["public"]["Tables"];

// 型の意図: id衝突時の部分更新（並び替えなど）で、Insert型の全プロパティを要求せず、
// 実際に送る一部の列 + id だけを許可したい。しかし supabase-js は Insert 形状を要求するため
// 最終的には安全な一括キャストが必要。そのキャスト地点をこの関数に集約する。
export type UpsertByIdInput<T extends TableName> = Partial<TablesInsert<T>> & { id: string };

export function asUpsertById<T extends TableName>(rows: UpsertByIdInput<T>[]): TablesInsert<T>[] {
  return rows as unknown as TablesInsert<T>[];
}

