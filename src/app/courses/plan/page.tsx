"use client";
import * as React from "react";
import { commitCoursePlan, saveDraft, deleteCourse } from "@/lib/client-api";
import type { CoursePlan } from "@/lib/types";
import { useRouter } from "next/navigation";
import { Header } from "@/components/ui/header";
import { SSETimeline } from "@/components/ui/SSETimeline";
import { useEffect, useRef, useState } from "react";
import { toast } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type TimedStep = { atMs: number; label: string };

export default function PlanCoursePage() {
  const router = useRouter();
  const [theme, setTheme] = useState("");
  const [level, setLevel] = useState("");
  const [goal, setGoal] = useState("");
  const [lessonCount, setLessonCount] = useState(6);
  const [plan, setPlan] = useState<CoursePlan | null>(null);
  const [editedPlan, setEditedPlan] = useState<CoursePlan | null>(null);
  // 生成直後の下書きIDは保持しない（編集結果を都度保存してコミット）
  const [generating, setGenerating] = useState(false);
  const [logs, setLogs] = useState<{ ts: number; text: string }[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [lessonKeys, setLessonKeys] = useState<string[]>([]);
  const timersRef = useRef<number[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((id) => clearTimeout(id));
      timersRef.current = [];
      abortRef.current?.abort();
    };
  }, []);

  // 進行表示をタイマーで行う（合計 ~60 秒で最終段階）
  function startProgressTimeline() {
    const scale = Number(process.env.NEXT_PUBLIC_TIMELINE_SCALE ?? "1");
    // クリア
    timersRef.current.forEach((id) => clearTimeout(id));
    timersRef.current = [];
    const now = Date.now();
    const steps: TimedStep[] = [
      { atMs: 0, label: "received" }, // 準備
      { atMs: 0, label: "normalizeInput" },
      { atMs: 15000, label: "planCourse" }, // 生成
      { atMs: 40000, label: "validatePlan" }, // 検証
      { atMs: 55000, label: "persistPreview" }, // 保存
      { atMs: 60000, label: "保存" }, // 最終段階（視覚的に完了）
    ];
    for (const s of steps) {
      const delay = Math.max(0, Math.round(s.atMs * scale));
      const id = window.setTimeout(() => {
        // タイムライン縮尺に合わせ、ログ時刻もスケール後の時刻で記録する
        setLogs((ls) => [...ls, { ts: now + delay, text: s.label }]);
      }, delay);
      timersRef.current.push(id);
    }
    // 60秒後に解決するPromiseを返す
    return new Promise<void>((resolve) => {
      const id = window.setTimeout(() => resolve(), Math.max(0, Math.round(60000 * scale)));
      timersRef.current.push(id);
    });
  }

  function startGenerate(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!theme.trim()) return alert("テーマは必須です");
    setPlan(null);
    // 前回の下書きIDは破棄
    setPreviewOpen(false);
    setLogs([]);
    setGenerating(true);
    // 中断用
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const progressP = startProgressTimeline();
    const fetchP = (async () => {
      try {
        const res = await fetch("/api/ai/outline", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ theme, level, goal, lessonCount }),
          signal: abortRef.current?.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { plan: CoursePlan; updates?: { ts: number; text: string }[] };
        const draft = await saveDraft("outline", data.plan);
        setPlan(data.plan);
        setEditedPlan(data.plan);
        setLessonKeys(data.plan.lessons.map((_, i) => `l-${Date.now()}-${i}`));
        if (Array.isArray(data.updates) && data.updates.length) {
          // サーバー生成のupdatesを優先してタイムラインに反映
          setLogs(data.updates);
        }
        // 初回生成時にも下書きは保存するが、編集コミット時に改めて保存し直す
        setLogs((s) => [...s, { ts: Date.now(), text: `下書きを保存しました（ID: ${draft.id}）` }]);
        setPreviewOpen(true);
      } catch (err: unknown) {
        const msg = (err as { message?: string })?.message ?? "unknown";
        setLogs((s) => [...s, { ts: Date.now(), text: `エラー: ${msg}` }]);
        // エラー時は即終了
        timersRef.current.forEach((id) => clearTimeout(id));
        timersRef.current = [];
        setGenerating(false);
      }
    })();

    // 進行表示(60s)と生成完了の両方が揃ったら完了扱い
    Promise.allSettled([progressP, fetchP]).then(() => {
      setGenerating(false);
    });
  }

  async function onCommit() {
    if (!editedPlan) return;
    // 編集結果を新しいドラフトとして保存してからコミット（全件反映）
    const draft = await saveDraft("outline", editedPlan);
    const newDraftId = draft.id;
    const res = await commitCoursePlan(newDraftId);
    if (!res) return alert("保存に失敗しました");
    try {
      toast({
        title: "保存しました",
        description: "コース案を反映しました。",
        actionLabel: "取り消す (60秒)",
        durationMs: 60000,
        onAction: () => { void deleteCourse(res.courseId); },
      });
    } catch {}
    router.replace(`/courses/${res.courseId}`);
  }

  function addLesson() {
    setEditedPlan((p) => {
      if (!p) return p;
      const nextIndex = p.lessons.length + 1;
      return {
        ...p,
        lessons: [...p.lessons, { title: `新しいレッスン ${nextIndex}`, summary: "" }],
      };
    });
    setLessonKeys((ks) => [...ks, `l-${Date.now()}-${(ks?.length ?? 0) + 1}`]);
  }

  function removeLesson(idx: number) {
    setEditedPlan((p) => {
      if (!p) return p;
      const lessons = p.lessons.slice();
      lessons.splice(idx, 1);
      return { ...p, lessons };
    });
    setLessonKeys((ks) => {
      const arr = ks.slice();
      arr.splice(idx, 1);
      return arr;
    });
  }

  function moveLesson(idx: number, dir: -1 | 1) {
    setEditedPlan((p) => {
      if (!p) return p;
      const j = idx + dir;
      if (j < 0 || j >= p.lessons.length) return p;
      const lessons = p.lessons.slice();
      const tmp = lessons[idx];
      lessons[idx] = lessons[j];
      lessons[j] = tmp;
      return { ...p, lessons };
    });
    setLessonKeys((ks) => {
      const j = idx + dir;
      if (j < 0 || j >= ks.length) return ks;
      const arr = ks.slice();
      const t = arr[idx];
      arr[idx] = arr[j];
      arr[j] = t;
      return arr;
    });
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = lessonKeys.indexOf(String(active.id));
    const to = lessonKeys.indexOf(String(over.id));
    if (from < 0 || to < 0 || !editedPlan) return;
    setLessonKeys((ks) => arrayMove(ks, from, to));
    setEditedPlan((p) => {
      if (!p) return p;
      const newLessons = arrayMove(p.lessons, from, to);
      return { ...p, lessons: newLessons };
    });
  }

  // 差分表示は廃止（編集プレビューに一本化）

  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* ストリーミング実行は廃止（タイマー進行表示に変更） */}
        <section className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AI コース設計</CardTitle>
              <CardDescription>入力 → 進行表示（タイマー）→ プレビュー編集 → 保存</CardDescription>
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
                <label htmlFor="theme" className="block text-sm font-medium mb-1">テーマ</label>
                <Input
                  id="theme"
                  data-testid="theme-input"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  placeholder="例: 機械学習 入門"
                  required
                />
              </div>
              <div>
                <label htmlFor="level" className="block text-sm font-medium mb-1">レベル（任意）</label>
                <Input
                  id="level"
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  placeholder="初級/中級/上級 など"
                />
              </div>
              <div>
                <label htmlFor="goal" className="block text-sm font-medium mb-1">目標（任意）</label>
                <Input
                  id="goal"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="例: 3週間で基礎を習得"
                />
              </div>
              <div>
                <label htmlFor="lessonCount" className="block text-sm font-medium mb-1">レッスン数</label>
                <Input
                  id="lessonCount"
                  type="number"
                  min={3}
                  max={30}
                  value={lessonCount}
                  onChange={(e) => setLessonCount(Number(e.target.value))}
                />
              </div>
              <div className="sm:col-span-2 flex items-center gap-2">
                <Button data-testid="generate-btn" type="submit" disabled={generating} variant="default">
                  {generating ? "生成中…" : "コース案を生成"}
                </Button>
                {plan && (
                  <>
                    <Button data-testid="regenerate-btn" type="button" onClick={startGenerate}>再生成</Button>
                    <Button data-testid="open-preview-btn" type="button" variant="secondary" onClick={() => setPreviewOpen(true)}>プレビューを開く</Button>
                  </>
                )}
              </div>
            </form>
            </CardContent>
          </Card>
          <Dialog
            open={previewOpen}
            onOpenChange={(open) => {
              if (open) {
                setPreviewOpen(true);
              } else {
                // 未保存の編集がある場合は意図しないクローズを防ぐ
                const hasDirty = JSON.stringify(editedPlan) !== JSON.stringify(plan);
                if (hasDirty) {
                  const ok = window.confirm("保存していない変更があります。閉じると破棄されます。閉じますか？");
                  if (!ok) return; // キャンセル
                }
                setPreviewOpen(false);
              }
            }}
          >
            {editedPlan && (
              <DialogContent
                className="max-w-3xl h-[100dvh] rounded-none sm:h-auto sm:rounded-md sm:max-h-[80dvh] p-0"
                onEscapeKeyDown={(e) => {
                  const hasDirty = JSON.stringify(editedPlan) !== JSON.stringify(plan);
                  if (hasDirty) e.preventDefault();
                }}
                onPointerDownOutside={(e) => {
                  const hasDirty = JSON.stringify(editedPlan) !== JSON.stringify(plan);
                  if (hasDirty) e.preventDefault();
                }}
              >
                <DialogHeader className="sticky top-0 z-10 bg-[hsl(var(--card))] px-6 pt-4 pb-3 border-b border-[hsl(var(--border))]">
                  <div className="flex items-start">
                    <div className="flex-1">
                      <DialogTitle>プレビューを編集</DialogTitle>
                      <DialogDescription>タイトル・説明・各レッスン名を直接編集できます。追加/削除/並び替えも可能です。</DialogDescription>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      aria-label="閉じる"
                      onClick={() => {
                        const hasDirty = JSON.stringify(editedPlan) !== JSON.stringify(plan);
                        if (hasDirty && !window.confirm("保存していない変更があります。閉じると破棄されます。閉じますか？")) return;
                        setPreviewOpen(false);
                      }}
                    >
                      ×
                    </Button>
                  </div>
                </DialogHeader>

                <div className="grid gap-4 px-6 py-4">
                  <div>
                    <label htmlFor="courseTitle" className="block text-sm font-medium mb-1">コースタイトル</label>
                    <Input
                      id="courseTitle"
                      autoFocus
                      value={editedPlan.course.title}
                      onChange={(e) => setEditedPlan((p) => (p ? { ...p, course: { ...p.course, title: e.target.value } } : p))}
                    />
                  </div>
                  <div>
                    <label htmlFor="courseDescription" className="block text-sm font-medium mb-1">コース説明（任意）</label>
                    <Textarea
                      id="courseDescription"
                      value={editedPlan.course.description ?? ""}
                      onChange={(e) => setEditedPlan((p) => (p ? { ...p, course: { ...p.course, description: e.target.value } } : p))}
                      placeholder="このコースの概要を入力"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">カテゴリ（任意）</label>
                    <Input
                      value={editedPlan.course.category ?? ""}
                      onChange={(e) => setEditedPlan((p) => (p ? { ...p, course: { ...p.course, category: e.target.value } } : p))}
                      placeholder="例: AI/データサイエンス"
                    />
                  </div>
                </div>

                <div className="mt-2 px-6 flex items-center justify-between">
                  <div className="text-sm text-gray-700">レッスン一覧</div>
                  <Button variant="outline" onClick={addLesson}>レッスンを追加</Button>
                </div>

                <div className="mt-2 px-6 pb-4">
                  <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                    <SortableContext items={lessonKeys} strategy={verticalListSortingStrategy}>
                      <ol className="space-y-3 list-decimal list-inside">
                        {editedPlan.lessons.map((l, idx) => (
                          <SortableLessonItem
                            key={lessonKeys[idx] ?? `k-${idx}`}
                            id={lessonKeys[idx] ?? `k-${idx}`}
                            index={idx}
                            title={l.title}
                            summary={l.summary}
                            onRemove={() => removeLesson(idx)}
                            onTitle={(v) => setEditedPlan((p) => {
                              if (!p) return p;
                              const lessons = p.lessons.slice();
                              lessons[idx] = { ...lessons[idx], title: v };
                              return { ...p, lessons };
                            })}
                            onSummary={(v) => setEditedPlan((p) => {
                              if (!p) return p;
                              const lessons = p.lessons.slice();
                              lessons[idx] = { ...lessons[idx], summary: v };
                              return { ...p, lessons };
                            })}
                            canMoveUp={idx > 0}
                            canMoveDown={idx < editedPlan.lessons.length - 1}
                            onMoveUp={() => moveLesson(idx, -1)}
                            onMoveDown={() => moveLesson(idx, 1)}
                          />
                        ))}
                      </ol>
                    </SortableContext>
                  </DndContext>
                </div>

                <div className="mt-2 sticky bottom-0 z-10 bg-[hsl(var(--card))] pt-3 px-6 pb-4 flex justify-end gap-2 border-t border-[hsl(var(--border))]">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      const hasDirty = JSON.stringify(editedPlan) !== JSON.stringify(plan);
                      if (hasDirty && !window.confirm("保存していない変更があります。閉じると破棄されます。閉じますか？")) return;
                      setPreviewOpen(false);
                    }}
                  >
                    閉じる
                  </Button>
                  <Button data-testid="commit-btn" onClick={onCommit} variant="default">保存して反映</Button>
                </div>
              </DialogContent>
            )}
          </Dialog>
        </section>

        <aside className="space-y-3">
          <h3 className="text-sm font-medium">進行状況</h3>
            <Tabs defaultValue="log">
              <TabsList>
                <TabsTrigger value="log">ログ</TabsTrigger>
              </TabsList>
              <TabsContent value="log">
                <SSETimeline logs={logs} />
              </TabsContent>
            </Tabs>
        </aside>
      </main>
    </div>
  );
}

type SortableLessonItemProps = {
  id: string;
  index: number;
  title: string;
  summary?: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onTitle: (v: string) => void;
  onSummary: (v: string) => void;
};

function SortableLessonItem(props: SortableLessonItemProps) {
  const { id, index, title, summary, canMoveUp, canMoveDown, onRemove, onMoveUp, onMoveDown, onTitle, onSummary } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  } as React.CSSProperties;
  return (
    <li ref={setNodeRef} style={style} className="flex items-start gap-3 rounded-md border border-[hsl(var(--border))] p-3 bg-[hsl(var(--card))] data-[dragging=true]:opacity-80" data-dragging={isDragging}>
      <div className="flex-1 grid gap-2">
        <div className="flex items-center gap-2">
          <label className="block text-xs text-gray-600">レッスン {index + 1}</label>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              aria-label="ドラッグで並び替え"
              className="cursor-grab active:cursor-grabbing rounded px-2 py-1 text-gray-500 hover:text-gray-800"
              {...listeners}
              {...attributes}
            >
              ⋮⋮
            </button>
            <Button type="button" size="sm" variant="outline" onClick={onMoveUp} disabled={!canMoveUp}>↑</Button>
            <Button type="button" size="sm" variant="outline" onClick={onMoveDown} disabled={!canMoveDown}>↓</Button>
            <Button type="button" size="sm" variant="destructive" onClick={onRemove}>削除</Button>
          </div>
        </div>
        <Input aria-label={`レッスン ${index + 1} タイトル`} value={title} onChange={(e) => onTitle(e.target.value)} />
        <Textarea aria-label={`レッスン ${index + 1} 説明`} value={summary ?? ""} onChange={(e) => onSummary(e.target.value)} placeholder="このレッスンで学ぶこと" />
      </div>
    </li>
  );
}
