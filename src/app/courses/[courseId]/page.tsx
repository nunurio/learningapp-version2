"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  getCourse,
  listLessons,
  addLesson,
  deleteLesson,
  reorderLessons,
  updateCourse,
  commitLessonCards,
  commitLessonCardsPartial,
  deleteCards,
  saveDraft,
} from "@/lib/localdb";
import type { Course, Lesson, LessonCards } from "@/lib/types";
import { Header } from "@/components/ui/header";
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetClose } from "@/components/ui/sheet";
import { SSETimeline } from "@/components/ui/SSETimeline";
import { useSSE } from "@/components/ai/useSSE";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogTrigger, DialogContent, DialogHeader as DlgHeader, DialogTitle as DlgTitle, DialogDescription as DlgDesc } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { toast } from "@/components/ui/toaster";
import { SortableList } from "@/components/dnd/SortableList";
function SSERunner({ url, body, onUpdate, onDone, onError }: any) {
  useSSE(url, body, { onUpdate, onDone, onError });
  return null;
}

export default function CourseDetailPage() {
  const router = useRouter();
  const params = useParams<{ courseId: string }>();
  const courseId = params.courseId;
  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [newLessonTitle, setNewLessonTitle] = useState("");

  // Preview state per lesson
  const [previews, setPreviews] = useState<Record<string, { draftId: string; payload: LessonCards }>>({});
  const [logsByLesson, setLogsByLesson] = useState<Record<string, { ts: number; text: string }[]>>({});
  const [runningLesson, setRunningLesson] = useState<Lesson | null>(null);
  const [lessonQuery, setLessonQuery] = useState("");

  function refresh() {
    const c = getCourse(courseId);
    setCourse(c ?? null);
    setLessons(listLessons(courseId));
  }

  useEffect(() => {
    refresh();
  }, [courseId]);

  const onAddLesson = () => {
    if (!newLessonTitle.trim()) return;
    addLesson(courseId, newLessonTitle);
    setNewLessonTitle("");
    refresh();
  };

  function onDeleteLesson(id: string) {
    if (!confirm("このレッスンを削除しますか？")) return;
    deleteLesson(id);
    refresh();
  }

  // DnD helpers
  const [dragId, setDragId] = useState<string | null>(null);
  function onDragStart(e: React.DragEvent<HTMLLIElement>, id: string) {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
  }
  function onDragOver(e: React.DragEvent<HTMLLIElement>) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }
  function onDrop(e: React.DragEvent<HTMLLIElement>, targetId: string) {
    e.preventDefault();
    if (!dragId || dragId === targetId) return;
    const ids = lessons.map((l) => l.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    reorderLessons(courseId, ids);
    setDragId(null);
    refresh();
  }

  function runSSEForLesson(lesson: Lesson) {
    setRunningLesson(lesson);
    setLogsByLesson((m) => ({ ...m, [lesson.id]: [] }));
  }

  const [selectedCardsByLesson, setSelectedCardsByLesson] = useState<Record<string, Record<number, boolean>>>({});

  function onCommitCards(lesson: Lesson) {
    const p = previews[lesson.id];
    if (!p) return;
    const selected = selectedCardsByLesson[lesson.id] || {};
    const idxs = Object.entries(selected).filter(([, v]) => v).map(([k]) => Number(k));
    const res = idxs.length > 0
      ? commitLessonCardsPartial({ draftId: p.draftId, lessonId: lesson.id, selectedIndexes: idxs })
      : commitLessonCards({ draftId: p.draftId, lessonId: lesson.id });
    if (!res) return alert("保存に失敗しました");
    toast({
      title: "保存しました",
      description: `${res.count} 件のカードを反映しました。`,
      actionLabel: "取り消す (60秒)",
      durationMs: 60000,
      onAction: () => deleteCards(res.cardIds),
    });
    setPreviews((prev) => {
      const copy = { ...prev };
      delete copy[lesson.id];
      return copy;
    });
    router.push(`/courses/${courseId}/lessons/${lesson.id}`);
  }

  if (!course) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <p className="text-sm text-gray-600">コースが見つかりませんでした。</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {runningLesson && (
          <SSERunner
            url="/api/ai/lesson-cards"
            body={{ lessonTitle: runningLesson.title, desiredCount: 6 }}
            onUpdate={(d: any) =>
              setLogsByLesson((m) => ({
                ...m,
                [runningLesson.id]: [...(m[runningLesson.id] ?? []), { ts: Date.now(), text: `${d?.node ?? d?.status}` }],
              }))
            }
            onDone={(d: any) => {
              const payload = d?.payload as LessonCards;
              if (payload) {
                const draft = saveDraft("lesson-cards", payload);
                setPreviews((prev) => ({ ...prev, [runningLesson.id]: { draftId: draft.id, payload } }));
                setLogsByLesson((m) => ({
                  ...m,
                  [runningLesson.id]: [...(m[runningLesson.id] ?? []), { ts: Date.now(), text: `下書きを保存しました（ID: ${draft.id}）` }],
                }));
              }
              setRunningLesson(null);
            }}
            onError={(d: any) => {
              setLogsByLesson((m) => ({
                ...m,
                [runningLesson.id]: [...(m[runningLesson.id] ?? []), { ts: Date.now(), text: `エラー: ${d?.message ?? "unknown"}` }],
              }));
              setRunningLesson(null);
            }}
          />
        )}
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold">{course.title}</h1>
            {course.description && (
              <p className="text-sm text-gray-600 mt-1">{course.description}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1 sm:gap-2">
            <Sheet>
              <SheetTrigger asChild><Button size="sm">レッスン一覧</Button></SheetTrigger>
              <SheetContent side="right" aria-label="レッスン一覧">
                <SheetHeader>
                  <div className="font-medium">レッスン一覧</div>
                  <SheetClose asChild><Button aria-label="閉じる">✕</Button></SheetClose>
                </SheetHeader>
                <div className="mb-2">
                  <label className="sr-only" htmlFor="lesson-search">レッスン検索</label>
                  <Input id="lesson-search" placeholder="レッスンを検索…" value={lessonQuery} onChange={(e) => setLessonQuery(e.target.value)} />
                </div>
                <ul className="space-y-2">
                  {lessons.filter((l) => {
                    const kw = lessonQuery.trim().toLowerCase();
                    return kw ? l.title.toLowerCase().includes(kw) : true;
                  }).map((l, i) => (
                    <li key={l.id} className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-6">{i + 1}</span>
                      <Link href={`#lesson-${l.id}`} className="truncate flex-1">{l.title}</Link>
                    </li>
                  ))}
                </ul>
              </SheetContent>
            </Sheet>
            <Button asChild size="sm"><Link href={`/learn/${course.id}`}>学習する</Link></Button>
            <Button asChild size="sm"><Link href={`/courses/${course.id}/workspace`}>ワークスペース</Link></Button>
          </div>
        </div>

      <section className="mb-4">
        <h2 className="font-medium mb-2">レッスン</h2>
        <div className="flex gap-2 mb-3">
          <Input
            value={newLessonTitle}
            onChange={(e) => setNewLessonTitle(e.target.value)}
            placeholder="レッスン名"
            className="flex-1"
          />
          <Button onClick={onAddLesson} variant="default">追加</Button>
        </div>
        <SortableList
          ids={lessons.map((l) => l.id)}
          label="レッスンの並び替え"
          onReorder={(ids) => { reorderLessons(courseId, ids); refresh(); }}
          renderItem={(id) => {
            // 並び替え/削除直後の一瞬の不整合に備えて存在チェック
            const l = lessons.find((x) => x.id === id);
            if (!l) return <div className="text-xs text-gray-400">更新中…</div>;
            return (
              <Card className="p-3" id={`lesson-${l.id}`}>
                <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                  <span className="font-medium w-full sm:flex-1 min-w-0 truncate">{l.title}</span>
                  {/* Keyboard-accessible reorder actions (WCAG 2.5.7) */}
                  <span className="hidden sm:inline-flex"><Button size="sm"
                    aria-label="上へ移動"
                    className="text-sm"
                    onClick={() => {
                      const ids = lessons.map((x) => x.id);
                      const i = ids.indexOf(l.id);
                      if (i > 0) {
                        const copy = [...ids];
                        copy.splice(i - 1, 0, copy.splice(i, 1)[0]);
                        reorderLessons(courseId, copy);
                        refresh();
                      }
                    }}
                  >↑</Button></span>
                  <span className="hidden sm:inline-flex"><Button size="sm"
                    aria-label="下へ移動"
                    className="text-sm"
                    onClick={() => {
                      const ids = lessons.map((x) => x.id);
                      const i = ids.indexOf(l.id);
                      if (i < ids.length - 1) {
                        const copy = [...ids];
                        copy.splice(i + 1, 0, copy.splice(i, 1)[0]);
                        reorderLessons(courseId, copy);
                        refresh();
                      }
                    }}
                  >↓</Button></span>
                  <TooltipProvider><Tooltip>
                    <TooltipTrigger asChild><Button asChild size="sm" className="text-sm"><Link href={`/courses/${courseId}/lessons/${l.id}`}>
                      <span className="hidden sm:inline">カード管理</span>
                      <span className="sm:hidden inline">カード</span>
                    </Link></Button></TooltipTrigger>
                    <TooltipContent>このレッスンのカードを編集</TooltipContent>
                  </Tooltip></TooltipProvider>
                  <TooltipProvider><Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="sm" onClick={() => runSSEForLesson(l)} disabled={runningLesson?.id === l.id} className="text-sm">
                        {runningLesson?.id === l.id ? "生成中…" : (
                          <>
                            <span className="hidden sm:inline">AIでカード生成</span>
                            <span className="sm:hidden inline">AI生成</span>
                          </>
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>AIでこのレッスンのカード案を生成</TooltipContent>
                  </Tooltip></TooltipProvider>
                  <TooltipProvider><Tooltip>
                    <TooltipTrigger asChild><Button size="sm" variant="destructive" onClick={() => onDeleteLesson(l.id)} className="text-sm">削除</Button></TooltipTrigger>
                    <TooltipContent>レッスンを削除</TooltipContent>
                  </Tooltip></TooltipProvider>
                </div>
                {previews[l.id] && (
                  <div className="mt-3 border-t pt-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm text-gray-600">プレビュー: {previews[l.id].payload.cards.length} 件</div>
                      <div className="flex gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button className="text-sm">差分プレビュー</Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DlgHeader>
                              <DlgTitle>差分プレビュー</DlgTitle>
                              <DlgDesc>生成されたカードの一覧です。保存で反映されます。</DlgDesc>
                            </DlgHeader>
                            <div className="text-sm text-gray-700 mb-2">反映するカードを選択（未選択なら全件）</div>
                            <ol className="text-sm space-y-1 list-decimal list-inside">
                              {previews[l.id].payload.cards.map((c, idx) => (
                                <li key={idx} className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    aria-label={`カード #${idx + 1} を選択`}
                                    checked={!!(selectedCardsByLesson[l.id]?.[idx])}
                                    onChange={(e) => setSelectedCardsByLesson((m) => ({
                                      ...m,
                                      [l.id]: { ...(m[l.id] || {}), [idx]: e.target.checked },
                                    }))}
                                  />
                                  <span className="px-1 py-0.5 rounded bg-black/5 mr-2">{c.type}</span>
                                  {"title" in c && c.title ? c.title : c.type === "text" ? "テキスト" : "カード"}
                                </li>
                              ))}
                            </ol>
                            <div className="mt-4 flex justify-end gap-2">
                              <Button onClick={() => onCommitCards(l)} variant="default">保存</Button>
                              <Button onClick={() => setPreviews((prev) => { const copy = { ...prev }; delete copy[l.id]; return copy; })}>破棄</Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                    <div className="mb-2">
                      <SSETimeline logs={logsByLesson[l.id] ?? []} />
                    </div>
                  </div>
                )}
              </Card>
            );
          }}
        />
      </section>
      </main>
    </div>
  );
}
