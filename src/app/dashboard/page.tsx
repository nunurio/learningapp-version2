import Link from "next/link";
import { Header } from "@/components/ui/header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, BookOpen, ArrowRight, Keyboard } from "lucide-react";
import HeroCarousel from "@/components/dashboard/HeroCarousel";
import { getDashboardSummaryCached } from "@/lib/db/dashboard";
import DeleteCourseButton from "@/components/dashboard/DeleteCourseButton";
import SrsReviewOverviewCard from "@/components/dashboard/SrsReviewOverviewCard";
import ContinueLearningCard from "@/components/dashboard/ContinueLearningCard";

export default async function Home() {
  const data = await getDashboardSummaryCached();
  const courses = data.courses;

  const first = courses[0];
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <Header minimal={false} />

      {/* Hero Section: Carousel */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-[hsl(var(--primary-500))]/5 to-[hsl(var(--primary-600))]/5" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-12">
          <HeroCarousel
            slides={[
              (
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
                        <Sparkles className="mr-2 h-4 w-4" aria-hidden />
                        AIでコースを作成
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="lg">
                      <Link href="/courses/new">手動でコースを作成</Link>
                    </Button>
                  </div>
                </div>
              ),
              (
                <div className="text-center">
                  <h2 className="text-3xl sm:text-4xl font-bold mb-3">ショートカットでさらに速く</h2>
                  <p className="text-[hsl(var(--fg))]/70 mb-6 max-w-xl mx-auto">
                    コマンドパレットで全機能にすぐアクセス。<br className="hidden sm:block" />
                    <span className="inline-flex items-center gap-2 font-medium">
                      <Keyboard className="h-4 w-4" aria-hidden /> ⌘K / Ctrl+K
                    </span>
                  </p>
                  <div className="flex justify-center">
                    <Button asChild size="lg" variant="outline">
                      <Link href="/courses/plan">
                        まずはコース作成から
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ),
              (
                <div className="text-center">
                  <h2 className="text-3xl sm:text-4xl font-bold mb-3">{first ? "最近のコースに戻る" : "最初のコースを作成"}</h2>
                  <p className="text-[hsl(var(--fg))]/70 mb-6 max-w-xl mx-auto">
                    {first ? `${first.title} を続けましょう。` : "学びたいテーマをもとに、AIが最適なプランを提案します。"}
                  </p>
                  <div className="flex justify-center">
                    {first ? (
                      <Button asChild size="lg">
                        <Link href={`/courses/${first.id}/workspace`}>
                          ワークスペースを開く
                        </Link>
                      </Button>
                    ) : (
                      <Button asChild size="lg">
                        <Link href="/courses/plan">
                          AIでコースを作る
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              ),
            ]}
          />
        </div>
      </section>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Stats & Continue */}
        <section aria-labelledby="dashboard-stats" className="grid gap-4 sm:grid-cols-2">
          <SrsReviewOverviewCard srs={data.stats.srs} />
          <ContinueLearningCard cont={data.continueLearning} />
        </section>

        {/* Courses */}
        <section aria-labelledby="your-courses" className="space-y-3">
          <div>
            <h2 id="your-courses" className="text-2xl font-bold text-[hsl(var(--fg))] mb-1">あなたのコース</h2>
            <p className="text-sm text-[hsl(var(--fg))]/60">
              {courses.length > 0 ? `${courses.length}個のコース` : "まだコースがありません"}
            </p>
          </div>

          {courses.length === 0 ? (
            <Card variant="elevated" className="p-12 text-center">
              <div className="max-w-md mx-auto">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
                  <BookOpen className="h-10 w-10" aria-hidden />
                </div>
                <h3 className="text-xl font-semibold mb-3">まだコースがありません</h3>
                <p className="text-[hsl(var(--fg))]/60 mb-6">
                  テーマを入力するだけで、AIが最適な学習プランを作成します。
                  今すぐ始めてみましょう！
                </p>
                <Button asChild variant="default" size="lg">
                  <Link href="/courses/plan">
                    <Sparkles className="mr-2 h-4 w-4" aria-hidden />
                    最初のコースを作る
                  </Link>
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((c) => (
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
                    <div className="flex items-center justify-between text-xs text-[hsl(var(--fg))]/50 mb-2">
                      <span>更新: {new Date(c.updatedAt).toLocaleDateString()}</span>
                      <span>完了率: {c.completionRate}%</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-[hsl(var(--fg))]/50 mb-4">
                      <span>カード {c.completedCards}/{c.totalCards}</span>
                      <span>フラグ {c.flaggedCards}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button asChild variant="default" size="sm" className="flex-1">
                        <Link href={`/courses/${c.id}/workspace`}>
                          ワークスペースを開く
                        </Link>
                      </Button>
                      <DeleteCourseButton courseId={c.id} />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Activity (placeholder for P1) */}
        <section aria-labelledby="recent-activity" className="space-y-3">
          <h2 id="recent-activity" className="text-xl font-semibold">最近の活動</h2>
          <Card variant="elevated" className="p-6 text-sm text-[hsl(var(--fg))]/60">
            近日追加予定です。
          </Card>
        </section>
      </main>
    </div>
  );
}
