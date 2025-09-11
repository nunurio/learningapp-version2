"use client";

import * as React from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import DeleteCourseButton from "@/components/dashboard/DeleteCourseButton";
import type { CourseSummary } from "@/lib/db/dashboard";

const PAGE_SIZE = 6; // 3 x 2

type Props = {
  courses: CourseSummary[];
};

export default function CoursesCards({ courses }: Props) {
  const [page, setPage] = React.useState(1);
  const totalPages = Math.max(1, Math.ceil(courses.length / PAGE_SIZE));

  React.useEffect(() => {
    // データ変化時は1ページ目へ戻す
    setPage(1);
  }, [courses.length]);

  const start = (page - 1) * PAGE_SIZE;
  const visible = courses.slice(start, start + PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((c) => (
          <Card key={c.id} variant="interactive" className="overflow-hidden group">
            <div className="h-2 bg-gradient-to-r from-[hsl(var(--primary-400))] to-[hsl(var(--primary-600))] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="p-6">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-lg line-clamp-1 flex-1">{c.title}</h3>
                <Badge
                  variant={c.status === "published" ? "statusPublished" : "statusDraft"}
                  size="sm"
                  aria-label={`ステータス: ${c.status}`}
                >
                  {c.status === "published" ? "公開" : "下書き"}
                </Badge>
              </div>
              {c.description && (
                <p className="text-sm text-[hsl(var(--fg))]/60 line-clamp-2 mb-3">{c.description}</p>
              )}
              <div className="mb-3">
                <Progress value={c.completionRate} max={100} variant="gradient" size="lg" />
                <div className="mt-1 text-xs text-[hsl(var(--fg))]/60 flex justify-between">
                  <span>完了率 {c.completionRate}%</span>
                  <span>カード {c.completedCards}/{c.totalCards}</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-[hsl(var(--fg))]/50 mb-4">
                <span>更新: {new Date(c.updatedAt).toLocaleDateString()}</span>
                <span>フラグ {c.flaggedCards}</span>
              </div>
              <div className="flex gap-2">
                <Button asChild variant="default" size="sm" className="flex-1">
                  <Link href={`/courses/${c.id}/workspace`}>ワークスペースを開く</Link>
                </Button>
                <DeleteCourseButton courseId={c.id} />
              </div>
            </div>
          </Card>
        ))}
        {Array.from({ length: Math.max(0, PAGE_SIZE - visible.length) }).map((_, i) => (
          <Card
            key={`placeholder-${i}`}
            variant="interactive"
            aria-hidden
            className="overflow-hidden opacity-0 pointer-events-none"
          >
            <div className="h-2" />
            <div className="p-6">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-lg flex-1">&nbsp;</h3>
                <Badge variant="statusDraft" size="sm" aria-hidden />
              </div>
              <div className="mb-3">
                <Progress value={0} max={100} variant="gradient" size="lg" />
                <div className="mt-1 text-xs flex justify-between">
                  <span>&nbsp;</span>
                  <span>&nbsp;</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs mb-4">
                <span>&nbsp;</span>
                <span>&nbsp;</span>
              </div>
              <div className="flex gap-2">
                <Button variant="default" size="sm" className="flex-1">&nbsp;</Button>
                <div className="w-9" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-[hsl(var(--fg))]/60">
          <div>
            {courses.length}件中 {start + 1}–{Math.min(start + PAGE_SIZE, courses.length)} を表示
          </div>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} />
              </PaginationItem>
              {Array.from({ length: totalPages }).map((_, i) => (
                <PaginationItem key={i}>
                  <PaginationLink onClick={() => setPage(i + 1)} isActive={page === i + 1}>
                    {i + 1}
                  </PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}

