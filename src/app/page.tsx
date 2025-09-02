"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { listCourses, deleteCourse, useLocalDbVersion } from "@/lib/localdb";
import type { Course } from "@/lib/types";
import { Header } from "@/components/ui/header";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Confirm } from "@/components/ui/confirm";

type StatusFilter = "all" | "draft" | "published";

export default function Home() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");

  const dbv = useLocalDbVersion();
  useEffect(() => {
    setCourses(listCourses());
  }, [dbv]);

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <Header onSearch={setQ} />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-[hsl(var(--primary-500))]/5 to-[hsl(var(--primary-600))]/5" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-12">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-[hsl(var(--primary-600))] to-[hsl(var(--primary-400))] bg-clip-text text-transparent">学習を、もっと楽しく</span>
            </h1>
            <p className="text-lg text-[hsl(var(--fg))]/70 mb-8 max-w-2xl mx-auto">
              AIの力で、あなただけの学習体験を。テーマを入力するだけで、パーソナライズされたコースが生成されます。
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild variant="default" size="lg" className="shadow-lg hover:shadow-xl">
                <Link href="/courses/plan">
                  <span className="mr-2">✨</span>
                  AIでコースを作成
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/courses/new">
                  手動でコースを作成
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
      
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-[hsl(var(--fg))] mb-1">あなたのコース</h2>
            <p className="text-sm text-[hsl(var(--fg))]/60">
              {courses.length > 0 ? `${courses.length}個のコース` : "まだコースがありません"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-[hsl(var(--fg))]/70">フィルタ:</label>
            <Select 
              value={filter} 
              onChange={(e) => setFilter(e.target.value as StatusFilter)}
              className="min-w-[120px]"
            >
              <option value="all">すべて</option>
              <option value="draft">下書き</option>
              <option value="published">公開済み</option>
            </Select>
          </div>
        </div>

        {courses.length === 0 ? (
          <Card variant="elevated" className="p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
                <span className="text-3xl">📚</span>
              </div>
              <h3 className="text-xl font-semibold mb-3">まだコースがありません</h3>
              <p className="text-[hsl(var(--fg))]/60 mb-6">
                テーマを入力するだけで、AIが最適な学習プランを作成します。
                今すぐ始めてみましょう！
              </p>
              <Button asChild variant="default" size="lg">
                <Link href="/courses/plan">
                  <span className="mr-2">✨</span>
                  最初のコースを作る
                </Link>
              </Button>
            </div>
          </Card>
        ) : filtered.length === 0 ? (
          <Card variant="elevated" className="p-8 text-center">
            <p className="text-[hsl(var(--fg))]/60">条件に合致するコースが見つかりませんでした。</p>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((c) => (
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
                    <p className="text-sm text-[hsl(var(--fg))]/60 line-clamp-2 mb-4">
                      {c.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-xs text-[hsl(var(--fg))]/50 mb-4">
                    <span>更新: {new Date(c.updatedAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button asChild variant="default" size="sm" className="flex-1">
                      <Link href={`/courses/${c.id}/workspace`}>
                        ワークスペースを開く
                      </Link>
                    </Button>
                    <Confirm
                      title="このコースを削除しますか？"
                      description="この操作は元に戻せません。関連するレッスンとカードも削除されます。"
                      confirmLabel="削除する"
                      cancelLabel="キャンセル"
                      onConfirm={async () => { await deleteCourse(c.id); refresh(); }}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="削除"
                        title="削除"
                      >
                        🗑️
                      </Button>
                    </Confirm>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
