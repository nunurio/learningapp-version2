export type DiffItem = {
  id?: string;
  label: string;
  kind: "add" | "update" | "delete";
};

import { Badge } from "@/components/ui/badge";

export function DiffList({ items }: { items: DiffItem[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="space-y-1 text-sm">
      {items.map((it, i) => (
        <li key={it.id ?? i} className="flex items-center gap-2">
          <Badge variant={it.kind === "add" ? "add" : it.kind === "update" ? "update" : "destructive"}>
            {it.kind === "add" ? "追加" : it.kind === "update" ? "更新" : "削除"}
          </Badge>
          <span>{it.label}</span>
        </li>
      ))}
    </ul>
  );
}
