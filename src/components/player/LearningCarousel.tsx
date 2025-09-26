"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import type { Card as CardModel, Progress, QuizCardContent, FillBlankCardContent, TextCardContent, UUID, Note } from "@/lib/types";
import * as clientApi from "@/lib/client-api";
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext, type CarouselApi } from "@/components/ui/carousel";
import { Progress as LinearProgress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { QuizOption } from "@/components/player/QuizOption";
import { QuizHintCard, QuizSolutionPanel } from "@/components/player/QuizSolutionPanel";
import { Card, CardContent } from "@/components/ui/card";
import MarkdownView from "@/components/markdown/MarkdownView";
import { notesHaveContent } from "@/lib/utils/notes";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, Star, StickyNote, HelpCircle, Plus, Trash2 } from "lucide-react";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { normalizeFillBlankText } from "@/lib/utils/fill-blank";
import { publishActiveRef } from "@/components/ai/active-ref";


type Props = {
  courseId: UUID;
  initialCardId?: UUID;
  initialLessonId?: UUID;
};

export function LearningCarousel({ courseId, initialCardId, initialLessonId }: Props) {
  const router = useRouter();
  const [cards, setCards] = React.useState<CardModel[]>([]);
  const [active, setActive] = React.useState(0);
  const [api, setApi] = React.useState<CarouselApi | null>(null);
  // ビューポート下端までの上限を計測するための ref と状態
  const carouselAreaRef = React.useRef<HTMLDivElement | null>(null);
  const [maxBodyHeight, setMaxBodyHeight] = React.useState<number | null>(null);
  const sliderAreaRef = React.useRef<HTMLDivElement | null>(null);
  // per-card state: quiz/fill の採点結果や入力、slider で決まった level
  const [results, setResults] = React.useState<Record<string, "idle" | "correct" | "wrong">>({});
  const [levels, setLevels] = React.useState<Record<string, number | undefined>>({});
  const [quizSel, setQuizSel] = React.useState<Record<string, number | null>>({});
  const [fillAns, setFillAns] = React.useState<Record<string, Record<string, string>>>({});
  const [flagged, setFlagged] = React.useState<Set<UUID>>(new Set());
  const [notes, setNotes] = React.useState<Record<string, Note[]>>({});
  const [noteDrafts, setNoteDrafts] = React.useState<Record<string, string>>({});
  const [newNoteDrafts, setNewNoteDrafts] = React.useState<Record<string, string>>({});
  const [noteOpenFor, setNoteOpenFor] = React.useState<string | null>(null);
  const [noteLoading, setNoteLoading] = React.useState<Record<string, boolean>>({});
  const [noteCreating, setNoteCreating] = React.useState<Record<string, boolean>>({});
  const [noteSaving, setNoteSaving] = React.useState<Record<string, boolean>>({});
  const [noteDeleting, setNoteDeleting] = React.useState<Record<string, boolean>>({});
  const [pendingFocusNoteId, setPendingFocusNoteId] = React.useState<string | null>(null);
  const noteTextareaRefs = React.useRef(new Map<string, HTMLTextAreaElement>());

  const noteTimestampFormatter = React.useMemo(() =>
    new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  , []);

  const formatNoteTimestamp = React.useCallback((iso: string) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return noteTimestampFormatter.format(date);
  }, [noteTimestampFormatter]);

  const loadNotesForCard = React.useCallback(async (cardId: UUID) => {
    setNoteLoading((state) => ({ ...state, [cardId]: true }));
    try {
      const response = await clientApi.listNotes(cardId);
      const sorted = [...response].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setNotes((prev) => {
        const prevNotes = prev[cardId] ?? [];
        setNoteDrafts((drafts) => {
          const next = { ...drafts };
          for (const old of prevNotes) {
            delete next[old.id];
            noteTextareaRefs.current.delete(old.id);
          }
          for (const note of sorted) {
            next[note.id] = note.text;
          }
          return next;
        });
        return { ...prev, [cardId]: sorted };
      });
    } catch (error) {
      console.error("Failed to load notes", error);
    } finally {
      setNoteLoading((state) => ({ ...state, [cardId]: false }));
    }
  }, []);

  const handleCreateNote = React.useCallback(async (cardId: UUID) => {
    const draft = (newNoteDrafts[cardId] ?? "").trim();
    if (!draft) return;
    setNoteCreating((state) => ({ ...state, [cardId]: true }));
    try {
      const created = await clientApi.createNote(cardId, draft);
      const newNote: Note = {
        id: created.noteId,
        cardId,
        text: draft,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      };
      setNotes((prev) => ({
        ...prev,
        [cardId]: [newNote, ...(prev[cardId] ?? [])],
      }));
      setNoteDrafts((drafts) => ({ ...drafts, [created.noteId]: draft }));
      setNewNoteDrafts((drafts) => ({ ...drafts, [cardId]: "" }));
      setPendingFocusNoteId(created.noteId);
    } catch (error) {
      console.error("Failed to create note", error);
    } finally {
      setNoteCreating((state) => ({ ...state, [cardId]: false }));
    }
  }, [newNoteDrafts]);

  const handleSaveNote = React.useCallback(async (cardId: UUID, noteId: UUID) => {
    const draft = (noteDrafts[noteId] ?? "").trim();
    if (!draft) return;
    setNoteSaving((state) => ({ ...state, [noteId]: true }));
    try {
      const updated = await clientApi.updateNote(noteId, { text: draft });
      setNotes((prev) => ({
        ...prev,
        [cardId]: (prev[cardId] ?? []).map((note) =>
          note.id === noteId ? { ...note, text: draft, updatedAt: updated.updatedAt } : note
        ),
      }));
      setNoteDrafts((drafts) => ({ ...drafts, [noteId]: draft }));
    } catch (error) {
      console.error("Failed to update note", error);
    } finally {
      setNoteSaving((state) => ({ ...state, [noteId]: false }));
    }
  }, [noteDrafts]);

  const handleDeleteNote = React.useCallback(async (cardId: UUID, noteId: UUID) => {
    setNoteDeleting((state) => ({ ...state, [noteId]: true }));
    try {
      await clientApi.deleteNote(noteId);
      setNotes((prev) => ({
        ...prev,
        [cardId]: (prev[cardId] ?? []).filter((note) => note.id !== noteId),
      }));
      setNoteDrafts((drafts) => {
        const next = { ...drafts };
        delete next[noteId];
        return next;
      });
      noteTextareaRefs.current.delete(noteId);
    } catch (error) {
      console.error("Failed to delete note", error);
    } finally {
      setNoteDeleting((state) => ({ ...state, [noteId]: false }));
    }
  }, []);

  React.useEffect(() => {
    if (!pendingFocusNoteId) return;
    const el = noteTextareaRefs.current.get(pendingFocusNoteId);
    if (el) {
      const len = el.value.length;
      el.focus();
      el.setSelectionRange(len, len);
      setPendingFocusNoteId(null);
    }
  }, [pendingFocusNoteId, notes]);

  // 画面下端までの最大高さを計測してセット（スライダー領域を差し引く）
  const measureLayout = React.useCallback(() => {
    const area = carouselAreaRef.current;
    if (!area || typeof window === "undefined") return;
    const rect = area.getBoundingClientRect();
    const sliderH = sliderAreaRef.current?.offsetHeight ?? 120; // 最低でもスライダー領域ぶんを確保
    const bottomGap = 8; // 余白
    const avail = Math.max(0, Math.floor(window.innerHeight - rect.top - sliderH - bottomGap));
    setMaxBodyHeight(avail);
  }, []);

  React.useEffect(() => {
    // 初期 + リサイズ時に再計測
    const raf = requestAnimationFrame(measureLayout);
    window.addEventListener("resize", measureLayout);
    window.addEventListener("orientationchange", measureLayout);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measureLayout);
      window.removeEventListener("orientationchange", measureLayout);
    };
  }, [measureLayout]);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const snap = await clientApi.snapshot();
      if (!mounted) return;
      const lessons = snap.lessons.filter((l) => l.courseId === courseId);
      const lessonOrder = new Map<string, number>(lessons.map((l) => [l.id, l.orderIndex] as const));
      const allCourseCards = snap.cards
        .filter((c) => lessons.some((l) => l.id === c.lessonId))
        .sort((a, b) => {
          const la = lessonOrder.get(a.lessonId) ?? 0;
          const lb = lessonOrder.get(b.lessonId) ?? 0;
          return (
            (la - lb) ||
            (a.orderIndex - b.orderIndex) ||
            a.createdAt.localeCompare(b.createdAt)
          );
        });

      // initialLessonId が指定された場合はそのレッスンにスコープ
      const scopedLessonId = initialLessonId && lessons.some((l) => l.id === initialLessonId) ? initialLessonId : undefined;
      const scopedCards = scopedLessonId ? allCourseCards.filter((c) => c.lessonId === scopedLessonId) : allCourseCards;
      const effectiveCards = scopedCards.length > 0 ? scopedCards : allCourseCards;

      // 開始位置の決定
      let startIndex = 0;
      if (initialCardId) {
        const idx = effectiveCards.findIndex((c) => c.id === initialCardId);
        startIndex = idx >= 0 ? idx : 0;
      } else if (scopedLessonId) {
        startIndex = 0; // レッスン指定時はその先頭
      } else {
        // レッスン未指定時: allCourseCards は lesson/orderIndex で既に昇順ソート済み。
        // そのためコース先頭カード（インデックス 0）から開始すれば期待どおり。
        startIndex = 0;
      }

      // 既存 progress をローカル状態へ反映（levels / results / quizSel / fillAns）
      // これにより再訪時に「未評価」にならず、クイズ/穴埋めも採点済み表示・入力値を復元できる
      const progressMap = new Map(snap.progress.map((p) => [p.cardId, p] as const));
      const initLevels: Record<string, number | undefined> = {};
      const initResults: Record<string, "idle" | "correct" | "wrong"> = {};
      const initQuizSel: Record<string, number | null> = {};
      const initFillAns: Record<string, Record<string, string>> = {};
      for (const c of effectiveCards) {
        const p = progressMap.get(c.id);
        if (!p) continue;
        const ans = p.answer;
        if (!ans || typeof ans !== "object") continue;
        const a = ans as Record<string, unknown>;
        // 共通: level
        const lv = a["level"];
        if (typeof lv === "number") initLevels[c.id] = lv;
        if (c.cardType === "quiz") {
          const sel = a["selected"];
          if (typeof sel === "number") initQuizSel[c.id] = sel;
          const r = a["result"];
          if (r === "correct" || r === "wrong") initResults[c.id] = r;
        } else if (c.cardType === "fill-blank") {
          const r = a["result"];
          if (r === "correct" || r === "wrong") initResults[c.id] = r;
          const vals: Record<string, string> = {};
          for (const [k, v] of Object.entries(a)) {
            if (k === "level" || k === "result") continue;
            if (typeof v === "string") vals[k] = v;
          }
          if (Object.keys(vals).length) initFillAns[c.id] = vals;
        }
      }

      setLevels(initLevels);
      setResults(initResults);
      setQuizSel(initQuizSel);
      setFillAns(initFillAns);

      // ノート初期化（スナップショットから）
      const noteMap: Record<string, Note[]> = {};
      for (const n of snap.notes) {
        const bucket = noteMap[n.cardId] ?? (noteMap[n.cardId] = []);
        bucket.push(n);
      }
      for (const key of Object.keys(noteMap)) {
        noteMap[key].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      }
      setNotes(noteMap);
      setNoteDrafts((drafts) => {
        const next = { ...drafts };
        for (const arr of Object.values(noteMap)) {
          for (const note of arr) {
            next[note.id] = note.text;
          }
        }
        return next;
      });

      setCards(effectiveCards);
      setActive(startIndex);

      // フラグ済みをロード（コース単位）
      let ids: UUID[] = [] as UUID[];
      if ("listFlaggedByCourse" in clientApi) {
        ids = await (clientApi as unknown as { listFlaggedByCourse: (cid: UUID) => Promise<UUID[]> }).listFlaggedByCourse(courseId);
      }
      if (!mounted) return;
      setFlagged(new Set(ids));
    })();
    return () => { mounted = false; };
  }, [courseId, initialCardId, initialLessonId]);

  // embla 選択変更で active を同期
  const handleSelect = React.useCallback((a?: CarouselApi) => {
    const inst = a ?? api;
    if (!inst) return;
    const idx = inst.selectedScrollSnap();
    setActive(idx);
  }, [api]);

  React.useEffect(() => {
    if (!api) return;
    // 初期化時に Embla 側の選択で active を上書きしない（意図した startIndex を優先）
    api.on("select", handleSelect);
    return () => { api.off("select", handleSelect); };
  }, [api, handleSelect]);

  // カード配列の変更を Embla に反映
  const prevCountRef = React.useRef<number>(0);
  React.useEffect(() => {
    if (!api) return;
    const count = cards.length;
    if (count !== prevCountRef.current) {
      prevCountRef.current = count;
      // スライド数が変わったら再初期化してから目的の位置へジャンプ
      try { api.reInit(); } catch { /* no-op */ }
      // 次フレームで確実に位置決め（測定完了後）
      requestAnimationFrame(() => {
        const idx = api.selectedScrollSnap();
        if (idx !== active) api.scrollTo(active, true);
      });
    }
  }, [api, cards.length, active]);

  // active 変更時に Embla を同期
  React.useEffect(() => {
    if (!api) return;
    const idx = api.selectedScrollSnap();
    if (idx !== active) api.scrollTo(active, true);
  }, [api, active]);

  React.useEffect(() => {
    const current = cards[active];
    if (!current) {
      publishActiveRef({ courseId, mode: "learn" });
      return;
    }
    publishActiveRef({
      courseId,
      lessonId: current.lessonId,
      cardId: current.id,
      mode: "learn",
    });
  }, [courseId, cards, active]);

  const current = cards[active];
  const progressValue = cards.length ? ((active + 1) / cards.length) * 100 : 0;
  const sliderVisible = current ? (current.cardType === "text" ? true : (results[current.id] ?? "idle") !== "idle") : false;

  // アクティブスライドの変化やスライダーの可視状態変化時に再計測
  React.useEffect(() => {
    const raf = requestAnimationFrame(measureLayout);
    return () => cancelAnimationFrame(raf);
  }, [measureLayout, active, sliderVisible]);

  // save helper
  // 同一 cardId への保存は直列化し、かつサーバー保存時に回答をマージして巻き戻りを防ぐ
  const saveQueueRef = React.useRef<Map<UUID, Promise<void>>>(new Map());
  const saveProgress = React.useCallback((input: Progress) => {
    // 1) 楽観更新（level のみ即時反映）
    if (typeof input.answer === "object" && input.answer && "level" in input.answer) {
      setLevels((m) => ({ ...m, [input.cardId]: (input.answer as Record<string, number>)["level"] }));
    }

    // 2) 送信 payload の回答オブジェクトをローカル既知の状態とマージ
    const card = cards.find((c) => c.id === input.cardId);
    const base = (typeof input.answer === "object" && input.answer) ? (input.answer as Record<string, unknown>) : {};
    const existing: Record<string, unknown> = {};
    // 既知の level
    const lv = levels[input.cardId];
    if (typeof lv === "number") existing["level"] = lv;
    if (card?.cardType === "quiz") {
      const sel = quizSel[input.cardId];
      if (typeof sel === "number") existing["selected"] = sel;
      const r = results[input.cardId];
      if (r === "correct" || r === "wrong") existing["result"] = r;
    } else if (card?.cardType === "fill-blank") {
      const vals = fillAns[input.cardId];
      if (vals) Object.assign(existing, vals);
      const r = results[input.cardId];
      if (r === "correct" || r === "wrong") existing["result"] = r;
    }
    const mergedAnswer = Object.keys(existing).length ? { ...existing, ...base } : base;

    // 3) 直列化キュー（カード単位）に投入
    const key = input.cardId as UUID;
    const prev = saveQueueRef.current.get(key) ?? Promise.resolve();
    const next = prev
      .catch((e) => { console.error("saveProgress queue previous failed:", e); })
      .then(async () => {
        try {
          await clientApi.saveProgress({ ...input, answer: mergedAnswer });
        } catch (e) {
          console.error("saveProgress failed:", e);
        }
      });
    saveQueueRef.current.set(key, next);
  }, [cards, levels, quizSel, results, fillAns]);

  return (
    <div className="relative h-full w-full flex flex-col">
      {/* 上部: 進捗バー */}
      <div className="px-4 pt-10 mb-3">
        <div className="max-w-2xl mx-auto">
          <LinearProgress value={progressValue} size="lg" aria-label="学習進捗" />
          <div className="mt-1 text-xs text-gray-600">{active + 1} / {cards.length}</div>
        </div>
      </div>

      {/* 本体: カルーセル（中央にカード。矢印ボタンで移動） */}
      <div ref={carouselAreaRef} className="relative flex items-stretch mt-0">
        <Carousel
          className="w-full max-w-2xl mx-auto px-2 sm:px-4"
          setApi={setApi}
          opts={{ align: "center", loop: false }}
        >
          <CarouselContent
            viewportClassName="py-3 sm:py-5"
            className="ml-0 mr-0"
          >
            {cards.map((card) => {
              const cardNotes = notes[card.id] ?? [];
              const hasNotes = notesHaveContent(cardNotes);
              const noteIsOpen = noteOpenFor === card.id;
              const loadingNotes = noteLoading[card.id] ?? false;
              const creatingNote = noteCreating[card.id] ?? false;
              const newNoteDraft = newNoteDrafts[card.id] ?? "";
              return (
                <CarouselItem key={card.id} className="px-4 sm:px-6">
                <Card
                  variant="elevated"
                  className="rounded-2xl shadow-[0_10px_24px_-16px_hsl(0_0%_0%/0.22),0_4px_12px_-8px_hsl(0_0%_0%/0.14)] hover:shadow-[0_16px_36px_-20px_hsl(0_0%_0%/0.28),0_8px_18px_-10px_hsl(0_0%_0%/0.16)]"
                >
                  <CardContent
                    className="p-6 min-h-[340px] sm:min-h-[440px] md:min-h-[500px] flex flex-col"
                    style={maxBodyHeight != null ? {
                      // デフォルトは既存の最小高さを尊重しつつ、画面下端まで拡張。
                      // JSDOM/SSR でも安全に動くよう null チェックし、インラインで minHeight を上書き。
                      maxHeight: maxBodyHeight,
                      minHeight: Math.min(maxBodyHeight, getDefaultMinHeight()),
                      overflowY: "auto",
                    } : undefined}
                  >
                    {/* タイトル + アクション */}
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <span className="px-2 py-1 rounded bg-black/5 text-xs">{card.cardType}</span>
                        {card.title ? <span className="ml-2 font-medium">{card.title}</span> : null}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          aria-label={flagged.has(card.id) ? "フラグ解除" : "フラグ"}
                          onClick={async () => {
                            let on = false;
                            if ("toggleFlag" in clientApi) {
                              on = await (clientApi as unknown as { toggleFlag: (id: UUID) => Promise<boolean> }).toggleFlag(card.id);
                            }
                            setFlagged((s) => {
                              const copy = new Set(s);
                              if (on) copy.add(card.id); else copy.delete(card.id);
                              return copy;
                            });
                          }}
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                        >
                          <Star className={flagged.has(card.id) ? "h-4 w-4 fill-current text-yellow-500" : "h-4 w-4"} />
                        </Button>
                        <Dialog
                          open={noteIsOpen}
                          onOpenChange={(open) => {
                            if (open) {
                              setNoteOpenFor(card.id);
                              void loadNotesForCard(card.id);
                              setNewNoteDrafts((drafts) => ({ ...drafts, [card.id]: drafts[card.id] ?? "" }));
                            } else {
                              setNoteOpenFor(null);
                            }
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button size="icon" variant="ghost" aria-label="ノート" className="h-8 w-8">
                              <StickyNote className={hasNotes ? "h-4 w-4 fill-current text-sky-500" : "h-4 w-4"} />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-lg">
                            <DialogHeader>
                              <DialogTitle>ノート</DialogTitle>
                              <DialogDescription>カードごとのメモを追加・編集できます。</DialogDescription>
                            </DialogHeader>
                            {loadingNotes ? (
                              <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 読み込み中…
                              </div>
                            ) : (
                              <div className="space-y-4">
                                <ScrollArea className="max-h-72 pr-3" data-testid="note-dialog-list">
                                  <div className="space-y-3 py-1">
                                    {cardNotes.length === 0 ? (
                                      <p className="px-1 text-sm text-muted-foreground">まだメモはありません。</p>
                                    ) : (
                                      cardNotes.map((note) => {
                                        const draft = noteDrafts[note.id] ?? "";
                                        const dirty = draft !== note.text;
                                        const saving = noteSaving[note.id] ?? false;
                                        const deleting = noteDeleting[note.id] ?? false;
                                        return (
                                          <Card key={note.id} data-testid={`note-dialog-item-${note.id}`}>
                                            <CardContent className="space-y-2 pt-4">
                                              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                                                <span>作成: {formatNoteTimestamp(note.createdAt)}</span>
                                                <span>更新: {formatNoteTimestamp(note.updatedAt)}</span>
                                              </div>
                                              <Textarea
                                                ref={(el) => {
                                                  if (el) {
                                                    noteTextareaRefs.current.set(note.id, el);
                                                  } else {
                                                    noteTextareaRefs.current.delete(note.id);
                                                  }
                                                }}
                                                value={draft}
                                                onChange={(e) => setNoteDrafts((drafts) => ({ ...drafts, [note.id]: e.target.value }))}
                                                placeholder="メモ…"
                                                rows={4}
                                              />
                                              <div className="flex justify-end gap-2">
                                                <Button
                                                  variant="outline"
                                                  size="sm"
                                                  onClick={() => setNoteDrafts((drafts) => ({ ...drafts, [note.id]: note.text }))}
                                                  disabled={!dirty || saving || deleting}
                                                >リセット</Button>
                                                <Button
                                                  size="sm"
                                                  onClick={() => handleSaveNote(card.id, note.id)}
                                                  disabled={!dirty || saving || deleting || !(draft.trim())}
                                                >
                                                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                                  保存
                                                </Button>
                                                <AlertDialog>
                                                  <AlertDialogTrigger asChild>
                                                    <Button size="sm" variant="destructive" disabled={deleting || saving}>
                                                      {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}削除
                                                    </Button>
                                                  </AlertDialogTrigger>
                                                  <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                      <AlertDialogTitle>メモを削除しますか？</AlertDialogTitle>
                                                      <AlertDialogDescription>
                                                        この操作は取り消せません。このメモを削除すると復元できません。
                                                      </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                      <AlertDialogCancel>キャンセル</AlertDialogCancel>
                                                      <AlertDialogAction
                                                        onClick={() => { void handleDeleteNote(card.id, note.id); }}
                                                        disabled={deleting}
                                                      >削除する</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                  </AlertDialogContent>
                                                </AlertDialog>
                                              </div>
                                            </CardContent>
                                          </Card>
                                        );
                                      })
                                    )}
                                  </div>
                                </ScrollArea>
                                <div className="space-y-2" data-testid="note-dialog-new">
                                  <Textarea
                                    value={newNoteDraft}
                                    onChange={(e) => setNewNoteDrafts((drafts) => ({ ...drafts, [card.id]: e.target.value }))}
                                    placeholder="新しいメモを入力…"
                                    rows={3}
                                  />
                                  <div className="flex justify-end gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setNewNoteDrafts((drafts) => ({ ...drafts, [card.id]: "" }))}
                                      disabled={!newNoteDraft}
                                    >クリア</Button>
                                    <Button
                                      size="sm"
                                      onClick={() => handleCreateNote(card.id)}
                                      disabled={creatingNote || !(newNoteDraft.trim())}
                                    >
                                      {creatingNote ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                                      追加
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>

                        {/* 学習モード用ヘルプ（Tooltip） */}
                        <TooltipProvider delayDuration={100}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="icon" variant="ghost" aria-label="ヘルプ" className="h-8 w-8">
                                <HelpCircle className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" align="end" className="max-w-xs">
                              <div className="space-y-1">
                                <p className="font-medium">学習モードの使い方</p>
                                <ul className="list-disc list-inside text-[11px] leading-snug">
                                  <li>左右の矢印／スワイプでカード移動</li>
                                  <li>クイズ/穴埋めは「Check」後に理解度を選択</li>
                                  <li>理解度が3以上で完了として保存</li>
                                  <li>★で要復習に追加、付箋でメモ保存</li>
                                  <li>右上ボタンでワークスペースに戻る</li>
                                </ul>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                    {/* カード本文 */}
                    <div className="text-[15px]">
                      {card.cardType === "text" && (
                        <TextContent content={card.content as TextCardContent} />
                      )}
                      {card.cardType === "quiz" && (
                        <QuizContent
                          cardId={card.id}
                          content={card.content as QuizCardContent}
                          selected={quizSel[card.id] ?? null}
                          onSelect={(n) => setQuizSel((m) => ({ ...m, [card.id]: n }))}
                          result={results[card.id] ?? "idle"}
                          onCheck={(res) => {
                            setResults((m) => ({ ...m, [card.id]: res }));
                            const input: Progress = { cardId: card.id, completed: false, answer: { selected: quizSel[card.id] ?? undefined, result: res } };
                            saveProgress(input);
                          }}
                        />
                      )}
                      {card.cardType === "fill-blank" && (
                        <FillBlankContent
                          cardId={card.id}
                          content={card.content as FillBlankCardContent}
                          values={fillAns[card.id] ?? {}}
                          onChange={(vals) => setFillAns((m) => ({ ...m, [card.id]: vals }))}
                          result={results[card.id] ?? "idle"}
                          onCheck={(res, vals) => {
                            setResults((m) => ({ ...m, [card.id]: res }));
                            const input: Progress = { cardId: card.id, completed: false, answer: { ...vals, result: res } };
                            saveProgress(input);
                          }}
                        />
                      )}
                    </div>
                  </CardContent>
                </Card>
                </CarouselItem>
              );
            })}
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>
      </div>

      {/* 下部: 理解度スライダー（text は常時、quiz/fill は Check 後） */}
      <div ref={sliderAreaRef} className="px-4 pb-4 pt-8">
        <div className="max-w-2xl mx-auto min-h-[80px]">
          {current ? (
            <UnderstandingBar
              cardId={current.id}
              visible={current.cardType === "text" ? true : (results[current.id] ?? "idle") !== "idle"}
              initial={levels[current.id]}
              onCommit={(lv) => {
                setLevels((m) => ({ ...m, [current.id]: lv }));
                const payload: Progress = {
                  cardId: current.id,
                  completed: lv >= 3,
                  completedAt: lv >= 3 ? new Date().toISOString() : undefined,
                  answer: { level: lv },
                };
                saveProgress(payload);
              }}
            />
          ) : (
            <div className="h-[80px]" aria-hidden />
          )}
        </div>
      </div>

      {/* 右上: 戻る */}
      <div className="absolute top-3 right-3">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            const targetId = current?.id;
            const url = targetId
              ? `/courses/${courseId}/workspace?cardId=${encodeURIComponent(targetId)}`
              : `/courses/${courseId}/workspace`;
            router.push(url);
          }}
          aria-label="ワークスペースに戻る"
        >
          ワークスペースに戻る
        </Button>
      </div>
    </div>
  );
}

function UnderstandingBar({ cardId, visible, initial, onCommit }: { cardId: string; visible: boolean; initial?: number; onCommit: (level: number) => void }) {
  const [lv, setLv] = React.useState<number>(initial ?? 0);
  React.useEffect(() => { setLv(initial ?? 0); }, [cardId, initial]);
  if (!visible) return null;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-gray-700">理解度: {lv > 0 ? `${lv}/5` : "未評価"}</span>
        <span className="text-xs text-gray-500">3以上で完了</span>
      </div>
      <Slider
        min={1}
        max={5}
        step={1}
        value={lv ? [lv] : [1]}
        onValueChange={(v) => setLv(v[0] ?? 1)}
        onValueCommit={(v) => onCommit(v[0] ?? 1)}
        aria-label="理解度"
      />
      <div className="mt-1 flex justify-between text-[10px] text-gray-500">
        <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
      </div>
    </div>
  );
}

function TextContent({ content }: { content: TextCardContent }) {
  return <MarkdownView markdown={content.body ?? ""} />;
}

function QuizContent({ cardId, content, selected, onSelect, result, onCheck }: {
  cardId: string;
  content: QuizCardContent;
  selected: number | null;
  onSelect: (n: number) => void;
  result: "idle" | "correct" | "wrong";
  onCheck: (res: "correct" | "wrong") => void;
}) {
  const [showHint, setShowHint] = React.useState(false);
  React.useEffect(() => { setShowHint(false); }, [cardId]);
  const hasHint = typeof content.hint === "string";
  const showResult = result !== "idle";
  return (
    <div>
      <MarkdownView
        markdown={content.question ?? ""}
        className="markdown-body text-base font-medium text-gray-900"
      />
      <div role="radiogroup" aria-label="選択肢" className="mt-2 space-y-2">
        {content.options.map((o, i) => (
          <QuizOption key={i} id={`opt-${cardId}-${i}`} label={o} checked={selected === i} onSelect={() => onSelect(i)} />
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button onClick={() => onCheck((selected ?? -1) === content.answerIndex ? "correct" : "wrong")} variant="default" aria-label="採点する">Check</Button>
        <Button
          onClick={() => setShowHint((v) => !v)}
          variant="outline"
          aria-label="ヒントを表示"
          aria-pressed={showHint && hasHint}
        >
          {showHint && hasHint ? "ヒントを隠す" : "Hint"}
        </Button>
        <span aria-live="polite" role="status" className={result === "correct" ? "text-green-600" : result === "wrong" ? "text-red-600" : "sr-only"}>
          {result === "correct" ? "正解！" : result === "wrong" ? "不正解" : ""}
        </span>
      </div>
      <QuizHintCard hint={content.hint ?? undefined} visible={showHint} />
      <QuizSolutionPanel content={content} selected={selected} visible={showResult} />
    </div>
  );
}

function FillBlankContent({ cardId, content, values, onChange, result, onCheck }: {
  cardId: string;
  content: FillBlankCardContent;
  values: Record<string, string>;
  onChange: (vals: Record<string, string>) => void;
  result: "idle" | "correct" | "wrong";
  onCheck: (res: "correct" | "wrong", vals: Record<string, string>) => void;
}) {
  const normalized = React.useMemo(() => normalizeFillBlankText(content.text), [content.text]);
  const indices = React.useMemo(() => Array.from(normalized.matchAll(/\[\[(\d+)\]\]/g)).map((m) => m[1]), [normalized]);
  const parts = React.useMemo(() => normalized.split(/(\[\[\d+\]\])/g), [normalized]);
  const placeholderPattern = /^\[\[(\d+)\]\]$/;
  function check() {
    const ok = indices.every((k) => {
      const a = (values[k] ?? "").trim();
      const expect = content.answers[k]?.trim() ?? "";
      if (!content.caseSensitive) return a.toLowerCase() === expect.toLowerCase();
      return a === expect;
    });
    onCheck(ok ? "correct" : "wrong", values);
  }
  return (
    <div>
      <div className="text-gray-900 text-base leading-relaxed">
        {parts.map((part, i) => {
          const m = part.match(placeholderPattern);
          if (!m) {
            if (!part) return null;
            if (!part.trim()) {
              return <span key={`space-${i}`} aria-hidden="true"> </span>;
            }
            return (
              <MarkdownView
                key={`text-${i}`}
                markdown={part}
                variant="inline"
              />
            );
          }
          const k = m[1];
          return (
            <span key={`blank-${i}`} className="inline-flex items-center align-middle mx-1">
              <Input
                className="inline-flex w-24"
                placeholder={`#${k}`}
                value={values[k] ?? ""}
                onChange={(e) => onChange({ ...values, [k]: e.target.value })}
              />
            </span>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button onClick={check} variant="default">Check</Button>
        <span aria-live="polite" role="status" className={result === "correct" ? "text-green-600" : result === "wrong" ? "text-red-600" : "sr-only"}>
          {result === "correct" ? "正解！" : result === "wrong" ? "不正解" : ""}
        </span>
      </div>
    </div>
  );
}

export default LearningCarousel;

// 現在のブレークポイントにおけるデフォルト最小高さ（Tailwind の sm/md と揃える）
function getDefaultMinHeight() {
  if (typeof window === "undefined") return 500;
  const w = window.innerWidth;
  if (w >= 768) return 500; // md:
  if (w >= 640) return 440; // sm:
  return 340; // base
}
