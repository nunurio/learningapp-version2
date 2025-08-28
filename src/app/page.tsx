"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { listCourses, deleteCourse } from "@/lib/localdb";
import type { Course } from "@/lib/types";
import { Header } from "@/components/ui/header";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

type StatusFilter = "all" | "draft" | "published";

export default function Home() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    setCourses(listCourses());
  }, []);

  function refresh() {
    setCourses(listCourses());
  }

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return courses.filter((c) => {
      const okStatus = filter === "all" ? true : c.status === filter;
      const okKw = kw ? (c.title.toLowerCase().includes(kw) || (c.description ?? "").toLowerCase().includes(kw)) : true;
      return okStatus && okKw;
    });
  }, [courses, q, filter]);

  return (
    <div className="min-h-screen">
      <Header onSearch={setQ} />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-medium">あなたのコース</h2>
          <div className="flex items-center gap-2 text-sm">
            <label className="text-gray-600">フィルタ:</label>
            <Select value={filter} onChange={(e) => setFilter(e.target.value as StatusFilter)}>
              <option value="all">すべて</option>
              <option value="draft">下書き</option>
              <option value="published">公開</option>
            </Select>
          </div>
        </div>

        {courses.length === 0 ? (
          <Card className="p-6">
            <p className="text-sm text-gray-600">テーマを入力するだけでAIがコース案を作成します。</p>
            <div className="mt-3">
              <Button asChild variant="default"><Link href="/courses/plan">まずはAIで作る</Link></Button>
            </div>
          </Card>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-600">条件に合致するコースが見つかりませんでした。</p>
        ) : (
          <Card className="divide-y divide-[hsl(var(--border))]">
            {filtered.map((c) => (
              <li key={c.id} className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium truncate">{c.title}</h3>
                      <Badge variant={c.status === "published" ? "statusPublished" : "statusDraft"} aria-label={`ステータス: ${c.status}`}>{c.status}</Badge>
                    </div>
                    {c.description ? (
                      <p className="text-sm text-gray-600 truncate">{c.description}</p>
                    ) : null}
                    <p className="text-xs text-gray-500 mt-1">更新日: {new Date(c.updatedAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <TooltipProvider><Tooltip>
                      <TooltipTrigger asChild><Button asChild><Link href={`/learn/${c.id}`} aria-label="学習を再開">学習を再開</Link></Button></TooltipTrigger>
                      <TooltipContent>このコースの学習を再開</TooltipContent>
                    </Tooltip></TooltipProvider>
                    <TooltipProvider><Tooltip>
                      <TooltipTrigger asChild><Button asChild><Link href={`/courses/${c.id}`} aria-label="編集">編集</Link></Button></TooltipTrigger>
                      <TooltipContent>コース内容を編集</TooltipContent>
                    </Tooltip></TooltipProvider>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        if (confirm("本当に削除しますか？ この操作は元に戻せません。")) {
                          deleteCourse(c.id);
                          refresh();
                        }
                      }}
                      aria-label="削除"
                    >
                      削除
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </Card>
        )}
      </main>
    </div>
  );
}
