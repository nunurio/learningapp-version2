import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DashboardSummary } from "@/lib/db/dashboard";

export function SrsReviewOverviewCard({ srs }: { srs: DashboardSummary["stats"]["srs"] }) {
  const totalUpcoming = srs.upcoming7.reduce((a, b) => a + b.count, 0);
  return (
    <Card variant="elevated" className="p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[hsl(var(--fg))]/70">今日のレビュー</h3>
        <Badge variant={srs.overdue > 0 ? "destructive" : "secondary"} size="sm" aria-label={`過期: ${srs.overdue}件`}>
          過期 {srs.overdue}
        </Badge>
      </div>
      <div className="mt-2 flex items-baseline gap-3">
        <span className="text-3xl font-bold">{srs.todayDue}</span>
        <span className="text-sm text-[hsl(var(--fg))]/60">今日</span>
        <span className="text-sm text-[hsl(var(--fg))]/40">/ 7日 {totalUpcoming}</span>
      </div>
      <div className="mt-4 grid grid-cols-7 gap-1" aria-label="今後7日間の予定">
        {srs.upcoming7.map((b) => (
          <div key={b.date} className="flex flex-col items-center gap-1">
            <div
              className="h-8 w-full rounded bg-[hsl(var(--primary-500))]/10"
              style={{ opacity: Math.min(0.15 + (b.count > 0 ? Math.min(1, b.count / 5) : 0), 1) }}
              aria-label={`${b.date} の予定 ${b.count}件`}
              title={`${b.date} / ${b.count}`}
            />
            <span className="text-[10px] text-[hsl(var(--fg))]/40">{b.date.slice(5)}</span>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <Button asChild size="sm">
          <Link href="/learn">今すぐレビュー</Link>
        </Button>
      </div>
    </Card>
  );
}

export default SrsReviewOverviewCard;

