"use client";
import { commitCoursePlan, commitCoursePlanPartial, saveDraft, deleteCourse } from "@/lib/localdb";
import type { CoursePlan } from "@/lib/types";
import { useRouter } from "next/navigation";
import { Header } from "@/components/ui/header";
import { SSETimeline } from "@/components/ui/SSETimeline";
import { useSSE } from "@/components/ai/useSSE";
import { useEffect, useState } from "react";
import { DiffList, type DiffItem } from "@/components/ui/DiffList";
import { toast } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type PlanUpdate = { node?: string; status?: string };
type PlanDone = { plan: CoursePlan; draftId: string };

function SSERunner({ url, body, onUpdate, onDone, onError }: {
  url: string;
  body: Record<string, unknown>;
  onUpdate: (d: PlanUpdate) => void;
  onDone: (d: PlanDone) => void;
  onError: (d: { message?: string }) => void;
}) {
  useSSE<PlanDone, PlanUpdate>(url, body, { onUpdate, onDone, onError });
  return null;
}

export default function PlanCoursePage() {
  const router = useRouter();
  const [theme, setTheme] = useState("");
  const [level, setLevel] = useState("");
  const [goal, setGoal] = useState("");
  const [lessonCount, setLessonCount] = useState(6);
  const [plan, setPlan] = useState<CoursePlan | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [logs, setLogs] = useState<{ ts: number; text: string }[]>([]);
  const [selected, setSelected] = useState<Record<number, boolean>>({});

  function startGenerate(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!theme.trim()) return alert("テーマは必須です");
    setPlan(null);
    setDraftId(null);
    setLogs([]);
    setGenerating(true);
  }

  function onCommit() {
    if (!draftId) return;
    const idxs = Object.entries(selected)
      .filter(([, v]) => v)
      .map(([k]) => Number(k));
    const res = idxs.length > 0 ? commitCoursePlanPartial(draftId, idxs) : commitCoursePlan(draftId);
    if (!res) return alert("保存に失敗しました");
    try {
      toast({
        title: "保存しました",
        description: "コース案を反映しました。",
        actionLabel: "取り消す (60秒)",
        durationMs: 60000,
        onAction: () => deleteCourse(res.courseId),
      });
    } catch {}
    router.replace(`/courses/${res.courseId}`);
  }

  const diffs: DiffItem[] = plan ? plan.lessons.map((l) => ({ kind: "add", label: l.title })) : [];

  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {generating && (
          <SSERunner
            url="/api/ai/outline"
            body={{ theme, level, goal, lessonCount }}
            onUpdate={(d) => setLogs((s) => [...s, { ts: Date.now(), text: `${d?.node ?? d?.status}` }])}
            onDone={(d) => {
              const p = d?.plan as CoursePlan;
              if (p) {
                const draft = saveDraft("outline", p);
                setPlan(p);
                setDraftId(draft.id);
                setLogs((s) => [...s, { ts: Date.now(), text: `下書きを保存しました（ID: ${draft.id}）` }]);
              }
              setGenerating(false);
            }}
            onError={(d) => {
              setLogs((s) => [...s, { ts: Date.now(), text: `エラー: ${d?.message ?? "unknown"}` }]);
              setGenerating(false);
            }}
          />
        )}
        <section className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AI コース設計</CardTitle>
              <CardDescription>入力 → ストリーミング → 差分プレビュー → 保存</CardDescription>
              <ol className="flex items-center gap-2 text-xs">
                <Badge variant="secondary">テーマ</Badge>
                <span>→</span>
                <Badge variant="secondary">レベル/目標</Badge>
                <span>→</span>
                <Badge variant="secondary">レッスン数</Badge>
                <span>→</span>
                <Badge variant="secondary">生成プレビュー</Badge>
              </ol>
            </CardHeader>
            <CardContent>
            <form onSubmit={startGenerate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-1">テーマ</label>
                <Input
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  placeholder="例: 機械学習 入門"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">レベル（任意）</label>
                <Input
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  placeholder="初級/中級/上級 など"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">目標（任意）</label>
                <Input
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="例: 3週間で基礎を習得"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">レッスン数</label>
                <Input
                  type="number"
                  min={3}
                  max={30}
                  value={lessonCount}
                  onChange={(e) => setLessonCount(Number(e.target.value))}
                />
              </div>
              <div className="sm:col-span-2 flex items-center gap-2">
                <Button type="submit" disabled={generating} variant="default">
                  {generating ? "生成中…" : "コース案を生成"}
                </Button>
                {plan && (
                  <>
                    <Button type="button" onClick={startGenerate}>再生成</Button>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button type="button">差分プレビュー</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>差分プレビュー</DialogTitle>
                          <DialogDescription>追加されるレッスンの一覧です。保存で反映されます。</DialogDescription>
                        </DialogHeader>
                        <DiffList items={diffs} />
                        <div className="mt-4 flex justify-end gap-2">
                          <Button onClick={onCommit} variant="default">保存して反映</Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </>
                )}
              </div>
            </form>
            </CardContent>
          </Card>

          {plan && (
            <Card>
              <CardHeader>
                <CardTitle>{plan.course.title}</CardTitle>
                {plan.course.description && (
                  <CardDescription>{plan.course.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="text-sm text-gray-700 mb-2">反映するレッスンを選択（未選択なら全件）</div>
                <ol className="mt-1 space-y-2 list-decimal list-inside">
                  {plan.lessons.map((l, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <input
                        aria-label={`${l.title} を選択`}
                        type="checkbox"
                        checked={!!selected[idx]}
                        onChange={(e) => setSelected((s) => ({ ...s, [idx]: e.target.checked }))}
                      />
                      <div>
                        <div className="font-medium">{l.title}</div>
                        {l.summary && <div className="text-sm text-gray-600">{l.summary}</div>}
                      </div>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}
        </section>

        <aside className="space-y-3">
          <h3 className="text-sm font-medium">進行状況</h3>
            <Tabs defaultValue="log">
              <TabsList>
                <TabsTrigger value="log">ログ</TabsTrigger>
                <TabsTrigger value="diff">差分</TabsTrigger>
              </TabsList>
              <TabsContent value="log">
                <SSETimeline logs={logs} />
              </TabsContent>
              <TabsContent value="diff">
                <Card className="p-3">
                  <DiffList items={diffs} />
                </Card>
              </TabsContent>
            </Tabs>
        </aside>
      </main>
    </div>
  );
}
