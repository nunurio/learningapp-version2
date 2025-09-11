"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable } from "@tanstack/react-table";
import { ArrowUpDown, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CourseSummary } from "@/lib/db/dashboard";
import DeleteCourseButton from "@/components/dashboard/DeleteCourseButton";

type Props = {
  courses: CourseSummary[];
};

const dateFmt = new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" });

export default function CoursesTable({ courses }: Props) {
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "updatedAt", desc: true }]);

  const columns = React.useMemo<ColumnDef<CourseSummary>[]>(
    () => [
      {
        accessorKey: "title",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-2"
          >
            タイトル
            <ArrowUpDown className="ml-1 h-3.5 w-3.5" aria-hidden />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="max-w-[380px]">
            <div className="font-medium line-clamp-1">{row.original.title}</div>
            {row.original.description ? (
              <div className="text-[0.8rem] text-[hsl(var(--fg))]/60 line-clamp-1">{row.original.description}</div>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "ステータス",
        cell: ({ getValue }) => {
          const v = String(getValue());
          return (
            <Badge variant={v === "published" ? "statusPublished" : "statusDraft"} size="sm">
              {v === "published" ? "公開" : "下書き"}
            </Badge>
          );
        },
        enableSorting: false,
      },
      {
        accessorKey: "updatedAt",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-2"
          >
            更新日
            <ArrowUpDown className="ml-1 h-3.5 w-3.5" aria-hidden />
          </Button>
        ),
        cell: ({ getValue }) => dateFmt.format(new Date(String(getValue()))),
        sortingFn: (a, b, id) => new Date(String(a.getValue(id))).getTime() - new Date(String(b.getValue(id))).getTime(),
      },
      {
        accessorKey: "totalLessons",
        header: ({ column }) => (
          <Button variant="ghost" size="sm" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-2"
          >
            レッスン
            <ArrowUpDown className="ml-1 h-3.5 w-3.5" aria-hidden />
          </Button>
        ),
        cell: ({ getValue }) => String(getValue()),
      },
      {
        accessorKey: "totalCards",
        header: ({ column }) => (
          <Button variant="ghost" size="sm" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-2">
            カード
            <ArrowUpDown className="ml-1 h-3.5 w-3.5" aria-hidden />
          </Button>
        ),
        cell: ({ getValue }) => String(getValue()),
      },
      {
        accessorKey: "completedCards",
        header: ({ column }) => (
          <Button variant="ghost" size="sm" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-2">
            完了
            <ArrowUpDown className="ml-1 h-3.5 w-3.5" aria-hidden />
          </Button>
        ),
        cell: ({ getValue }) => String(getValue()),
      },
      {
        accessorKey: "completionRate",
        header: ({ column }) => (
          <Button variant="ghost" size="sm" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-2">
            完了率
            <ArrowUpDown className="ml-1 h-3.5 w-3.5" aria-hidden />
          </Button>
        ),
        cell: ({ getValue, row }) => (
          <div className="flex items-center gap-2">
            <div className="h-2 w-24 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
              <div
                className="h-full bg-[hsl(var(--primary))]"
                style={{ width: `${Math.min(100, Number(getValue()))}%` }}
              />
            </div>
            <span className="tabular-nums">{row.original.completionRate}%</span>
          </div>
        ),
        sortingFn: (a, b, id) => Number(a.getValue(id)) - Number(b.getValue(id)),
      },
      {
        accessorKey: "flaggedCards",
        header: ({ column }) => (
          <Button variant="ghost" size="sm" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-2">
            フラグ
            <ArrowUpDown className="ml-1 h-3.5 w-3.5" aria-hidden />
          </Button>
        ),
        cell: ({ getValue }) => String(getValue()),
      },
      {
        id: "actions",
        header: "操作",
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button asChild variant="ghost" size="sm">
              <Link href={`/courses/${row.original.id}/workspace`} aria-label="ワークスペースを開く">
                <ExternalLink className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
            <DeleteCourseButton courseId={row.original.id} />
          </div>
        ),
        enableSorting: false,
      },
    ],
    []
  );

  const table = useReactTable({
    data: courses,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="w-full">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((h) => (
                <TableHead key={h.id}>
                  {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((r) => (
              <TableRow key={r.id} data-state={r.getIsSelected() ? "selected" : undefined}>
                {r.getVisibleCells().map((c) => (
                  <TableCell key={c.id}>{flexRender(c.column.columnDef.cell, c.getContext())}</TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center text-[hsl(var(--fg))]/60">
                コースがありません
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
