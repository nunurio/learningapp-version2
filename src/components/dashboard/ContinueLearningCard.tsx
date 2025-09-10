import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { DashboardSummary } from "@/lib/db/dashboard";

export function ContinueLearningCard({ cont }: { cont?: NonNullable<DashboardSummary["continueLearning"]> }) {
  return (
    <Card variant="elevated" className="p-6">
      <h3 className="text-sm font-medium text-[hsl(var(--fg))]/70">継続学習</h3>
      {cont ? (
        <div className="mt-2 flex items-center justify-between">
          <div className="text-sm text-[hsl(var(--fg))]/70">
            最終更新: {new Date(cont.lastActivityAt).toLocaleString()}
          </div>
          <Button asChild size="sm">
            <Link href={`/learn/${cont.courseId}?lessonId=${cont.lessonId}&cardId=${cont.cardId}`}>
              学習を再開
            </Link>
          </Button>
        </div>
      ) : (
        <div className="mt-3 text-sm text-[hsl(var(--fg))]/60">
          最近の学習はまだありません。まずはコースを作成しましょう。
          <div className="mt-3">
            <Button asChild size="sm">
              <Link href="/courses/plan">AIでコースを作成</Link>
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

export default ContinueLearningCard;

