"use client";
import * as React from "react";
import {
  snapshot as fetchSnapshot,
  addLesson as addLessonApi,
  reorderLessons as reorderLessonsApi,
  deleteLesson as deleteLessonApi,
  addCard as addCardApi,
  deleteCard as deleteCardApi,
  reorderCards as reorderCardsApi,
  commitLessonCards as commitLessonCardsApi,
  commitLessonCardsPartial as commitLessonCardsPartialApi,
  createNote as createNoteApi,
  updateNote as updateNoteApi,
  deleteNote as deleteNoteApi,
} from "@/lib/client-api";
import type {
  UUID,
  Card as WorkspaceCard,
  Lesson,
  Course,
  QuizCardContent,
  FillBlankCardContent,
  LessonCards,
  CardType,
  TextCardContent,
  Note,
} from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SSETimeline } from "@/components/ui/SSETimeline";
import { LessonCardsRunner } from "@/components/ai/LessonCardsRunner";
import { SingleCardRunner } from "@/components/ai/SingleCardRunner";
import { Confirm } from "@/components/ui/confirm";
import { Select } from "@/components/ui/select";
import {
  ShadSelect as SelectMenu,
  ShadSelectTrigger as SelectMenuTrigger,
  ShadSelectContent as SelectMenuContent,
  ShadSelectItem as SelectMenuItem,
  ShadSelectValue as SelectMenuValue,
} from "@/components/ui/shadcn-select";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils/cn";
import { SortableList } from "@/components/dnd/SortableList";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { saveCard, type SaveCardDraftInput } from "@/lib/data";
import { workspaceStore, useWorkspace } from "@/lib/state/workspace-store";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Plus, Trash2, Loader2, MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
// Milkdown 削除に伴い自家製エディタへ移行（Inspectorでは素のTextareaを使用）

type Props = {
  courseId: UUID;
  selectedId?: UUID;
  selectedKind?: "lesson" | "card";
};

type QuizDraft = Extract<SaveCardDraftInput, { cardType: "quiz" }>;

function normalizeQuizForm(input: QuizDraft): QuizDraft {
  const options = [...(input.options ?? [])];
  if (options.length === 0) {
    options.push("", "");
  } else if (options.length === 1) {
    options.push("");
  }
  const optionExplanations = [...(input.optionExplanations ?? [])];
  if (optionExplanations.length > options.length) {
    optionExplanations.length = options.length;
  } else {
    for (let i = optionExplanations.length; i < options.length; i++) {
      optionExplanations[i] = "";
    }
  }
  let answerIndex = input.answerIndex ?? 0;
  if (options.length === 0) {
    answerIndex = 0;
  } else if (answerIndex < 0) {
    answerIndex = 0;
  } else if (answerIndex >= options.length) {
    answerIndex = options.length - 1;
  }
  return { ...input, options, optionExplanations, answerIndex };
}

export function Inspector({ courseId, selectedId, selectedKind }: Props) {
  // subscribe to workspace store (no direct read needed here, but keeps future-dependent UIs in sync)
  useWorkspace();
  const [course, setCourse] = React.useState<Course | null>(null);
  const [lesson, setLesson] = React.useState<Lesson | null>(null);
  const [card, setCard] = React.useState<WorkspaceCard | null>(null);
  const [form, setForm] = React.useState<SaveCardDraftInput | null>(null);
  const [saving, setSaving] = React.useState<"idle" | "saving" | "saved">("idle");
  const [savedAt, setSavedAt] = React.useState<string | null>(null);
  const [dirty, setDirty] = React.useState(false);
  const formRef = React.useRef<SaveCardDraftInput | null>(form);
  const [lessons, setLessons] = React.useState<Lesson[]>([]);
  const [cards, setCards] = React.useState<WorkspaceCard[]>([]);
  const [notesByCard, setNotesByCard] = React.useState<Record<string, Note[]>>({});
  const [activeNoteId, setActiveNoteId] = React.useState<UUID | null>(null);
  const [noteDrafts, setNoteDrafts] = React.useState<Record<string, string>>({});
  const [noteStatuses, setNoteStatuses] = React.useState<Record<string, "idle" | "creating" | "updating" | "deleting">>({});
  const [newNoteDraft, setNewNoteDraft] = React.useState("");
  const [noteAccordionOpen, setNoteAccordionOpen] = React.useState(false);
  const [noteToDelete, setNoteToDelete] = React.useState<Note | null>(null);
  // Reserved UI states (unused currently)

  // AI lesson-cards generation state
  const [runningLesson, setRunningLesson] = React.useState<Lesson | null>(null);
  const [logsByLesson, setLogsByLesson] = React.useState<Record<string, { ts: number; text: string }[]>>({});
  const [previews, setPreviews] = React.useState<Record<string, { draftId: string; payload: LessonCards }>>({});
  const [selectedIndexes, setSelectedIndexes] = React.useState<Record<string, Record<number, boolean>>>({});
  // fill-blank 回答の一時テキスト（未完成行の入力を保持）
  const [answersText, setAnswersText] = React.useState<string>("");
  const [richMode, setRichMode] = React.useState(false);
  const existingNoteFieldId = React.useId();
  const newNoteFieldId = React.useId();
  const quizFieldIdBase = React.useId();
  const router = useRouter();
  const [pendingAction, setPendingAction] = React.useState<(() => void) | null>(null);
  const requestDiscard = React.useCallback((action: () => void) => {
    if (!dirty) {
      action();
      return;
    }
    setPendingAction(() => action);
  }, [dirty]);

  const refreshLists = React.useCallback(async function refreshLists() {
    const snap = await fetchSnapshot();
    const co = snap.courses.find((c) => c.id === courseId) ?? null;
    setCourse(co);
    const ls = snap.lessons.filter((l) => l.courseId === courseId).sort((a, b) => a.orderIndex - b.orderIndex || a.createdAt.localeCompare(b.createdAt));
    setLessons(ls);
    const noteMap: Record<string, Note[]> = {};
    for (const n of snap.notes) {
      const bucket = noteMap[n.cardId] ?? (noteMap[n.cardId] = []);
      bucket.push(n);
    }
    for (const key of Object.keys(noteMap)) {
      noteMap[key].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    setNotesByCard(noteMap);
    setNoteDrafts(() => {
      const drafts: Record<string, string> = {};
      for (const arr of Object.values(noteMap)) {
        for (const note of arr) {
          drafts[note.id] = note.text;
        }
      }
      return drafts;
    });
    if (selectedKind === "lesson" && selectedId) {
      const l = ls.find((x) => x.id === selectedId) ?? null;
      setLesson(l);
      setCards(l ? snap.cards.filter((c) => c.lessonId === l.id).sort((a, b) => a.orderIndex - b.orderIndex || a.createdAt.localeCompare(b.createdAt)) : []);
      setCard(null);
    } else if (selectedKind === "card" && selectedId) {
      const l = ls.find((x) => snap.cards.some((c) => c.lessonId === x.id && c.id === selectedId));
      setLesson(null);
      setCards([]);
      const found = (l ? snap.cards.filter((c) => c.lessonId === l.id) : []).find((c) => c.id === selectedId) ?? null;
      setCard(found ?? null);
    } else {
      setLesson(null); setCards([]); setCard(null);
    }
  }, [courseId, selectedId, selectedKind]);

  React.useEffect(() => { void refreshLists(); }, [refreshLists]);

  React.useEffect(() => {
    formRef.current = form;
  }, [form]);

  const applyDraftUpdate = React.useCallback((
    mutator: (current: SaveCardDraftInput) => SaveCardDraftInput | null | undefined,
  ) => {
    const current = formRef.current;
    if (!current) return;
    const next = mutator(current);
    if (!next || next === current) return;
    formRef.current = next;
    setForm(next);
    workspaceStore.setDraft(next);
    setDirty(true);
    setSaving("idle");
  }, []);

  const handleSave = React.useCallback(async (): Promise<boolean> => {
    const snapshot = formRef.current;
    if (!snapshot) return false;
    setSaving("saving");
    try {
      const res = await saveCard(snapshot);
      const drafts = workspaceStore.getSnapshot().drafts;
      const draftInStore = drafts[snapshot.cardId];
      const snapshotJson = JSON.stringify(snapshot);
      const draftDiffers = !!draftInStore && JSON.stringify(draftInStore) !== snapshotJson;
      const current = formRef.current;
      const sameCard = current?.cardId === snapshot.cardId;
      const hasChangesSinceSnapshot = sameCard && current !== snapshot;
      const hasPendingDraft = draftDiffers || hasChangesSinceSnapshot;

      if (sameCard) {
        setSavedAt(res.updatedAt);
        setSaving(hasPendingDraft ? "idle" : "saved");
        if (!hasPendingDraft) {
          setDirty(false);
        }
      } else {
        setSaving("idle");
      }

      if (!hasPendingDraft) {
        workspaceStore.clearDraft(snapshot.cardId);
      }
      workspaceStore.bumpVersion();
      return hasPendingDraft;
    } catch (err) {
      console.error(err);
      setSaving("idle");
      throw err;
    }
  }, []);

  const updateQuizForm = React.useCallback((updater: (draft: QuizDraft) => QuizDraft) => {
    applyDraftUpdate((current) => {
      if (current.cardType !== "quiz") return current;
      return normalizeQuizForm(updater(current));
    });
  }, [applyDraftUpdate]);

  const handleQuizOptionChange = React.useCallback((index: number, value: string) => {
    updateQuizForm((draft) => {
      const options = [...draft.options];
      options[index] = value;
      return { ...draft, options };
    });
  }, [updateQuizForm]);

  const handleQuizExplanationChange = React.useCallback((index: number, value: string) => {
    updateQuizForm((draft) => {
      const optionExplanations = [...(draft.optionExplanations ?? [])];
      optionExplanations[index] = value;
      return { ...draft, optionExplanations };
    });
  }, [updateQuizForm]);

  const handleQuizAddOption = React.useCallback(() => {
    updateQuizForm((draft) => ({
      ...draft,
      options: [...draft.options, ""],
      optionExplanations: [...(draft.optionExplanations ?? []), ""],
    }));
  }, [updateQuizForm]);

  const handleQuizRemoveOption = React.useCallback((index: number) => {
    updateQuizForm((draft) => {
      if (draft.options.length <= 2) return draft;
      const options = draft.options.filter((_, idx) => idx !== index);
      const optionExplanations = (draft.optionExplanations ?? []).filter((_, idx) => idx !== index);
      let answerIndex = draft.answerIndex;
      if (options.length === 0) {
        answerIndex = 0;
      } else if (answerIndex === index) {
        answerIndex = Math.max(0, Math.min(index - 1, options.length - 1));
      } else if (answerIndex > index) {
        answerIndex -= 1;
      }
      return { ...draft, options, optionExplanations, answerIndex };
    });
  }, [updateQuizForm]);

  const handleQuizSetCorrect = React.useCallback((index: number) => {
    updateQuizForm((draft) => ({ ...draft, answerIndex: index }));
  }, [updateQuizForm]);

  // 下書き or 現行値でフォーム初期化
  React.useEffect(() => {
    if (!card) {
      setForm(null);
      setDirty(false);
      setAnswersText("");
      setSaving("idle");
      setSavedAt(null);
      return;
    }
    setRichMode(false);
    if (card.cardType === "text") {
      const c = card.content as TextCardContent;
      setForm({ cardId: card.id, cardType: "text", title: card.title ?? null, tags: card.tags ?? [], body: c.body ?? "" });
      setAnswersText("");
    } else if (card.cardType === "quiz") {
      const c = card.content as QuizCardContent;
      const optionExplanations = [...(c.optionExplanations ?? [])];
      for (let i = optionExplanations.length; i < c.options.length; i++) {
        optionExplanations[i] = "";
      }
      const quizForm: QuizDraft = {
        cardId: card.id,
        cardType: "quiz",
        title: card.title ?? null,
        tags: card.tags ?? [],
        question: c.question,
        options: c.options,
        answerIndex: c.answerIndex,
        explanation: c.explanation ?? null,
        optionExplanations,
        hint: c.hint ?? null,
      };
      setForm(normalizeQuizForm(quizForm));
      setAnswersText("");
    } else {
      const c = card.content as FillBlankCardContent;
      setForm({ cardId: card.id, cardType: "fill-blank", title: card.title ?? null, tags: card.tags ?? [], text: c.text, answers: c.answers, caseSensitive: !!c.caseSensitive });
      const s = Object.entries(c.answers ?? {}).map(([k, v]) => `${k}:${v}`).join("\n");
      setAnswersText(s);
    }
    setDirty(false);
    setSaving("idle");
    setSavedAt(null);
    workspaceStore.clearDraft(card.id);
  }, [card]);

  // 現在のレッスン（カード選択時も親レッスンを解決）
  const currentLesson: Lesson | null = (() => {
    if (selectedKind === "lesson" && selectedId) {
      return lessons.find((x) => x.id === selectedId) ?? null;
    }
    if (selectedKind === "card" && selectedId) {
      if (card) return lessons.find((x) => x.id === card.lessonId) ?? null;
      return null;
    }
    return null;
  })();

  const [lessonToolsOpen, setLessonToolsOpen] = React.useState(true);
  const [cardEditorOpen, setCardEditorOpen] = React.useState(true);

  React.useEffect(() => {
    setLessonToolsOpen(true);
  }, [currentLesson?.id]);

  React.useEffect(() => {
    setCardEditorOpen(true);
  }, [card?.id]);

  const noteTimeFormatter = React.useMemo(
    () =>
      new Intl.DateTimeFormat("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
    []
  );

  const formatNoteTime = React.useCallback(
    (iso: string | undefined) => {
      if (!iso) return "-";
      const date = new Date(iso);
      if (Number.isNaN(date.getTime())) return iso;
      return noteTimeFormatter.format(date);
    },
    [noteTimeFormatter]
  );

  React.useEffect(() => {
    if (selectedKind === "card" && selectedId) {
      const list = notesByCard[selectedId] ?? [];
      setActiveNoteId((prev) => {
        if (prev && list.some((n) => n.id === prev)) return prev;
        return list[0]?.id ?? null;
      });
      setNoteAccordionOpen(true);
    } else {
      setActiveNoteId(null);
      setNewNoteDraft("");
      setNoteAccordionOpen(false);
    }
  }, [notesByCard, selectedId, selectedKind]);

  const currentCardNotes = React.useMemo(() => {
    if (selectedKind !== "card" || !selectedId) return [] as Note[];
    return notesByCard[selectedId] ?? [];
  }, [notesByCard, selectedId, selectedKind]);

  const activeNote = React.useMemo(() => {
    if (!activeNoteId) return null;
    return currentCardNotes.find((note) => note.id === activeNoteId) ?? null;
  }, [activeNoteId, currentCardNotes]);

  const activeNoteDraft = activeNote ? noteDrafts[activeNote.id] ?? activeNote.text : "";
  const activeNoteDirty = activeNote ? (noteDrafts[activeNote.id] ?? activeNote.text) !== activeNote.text : false;
  const activeNoteStatus = activeNote ? noteStatuses[activeNote.id] ?? "idle" : "idle";

  const handleSelectNote = React.useCallback((noteId: UUID) => {
    setActiveNoteId(noteId);
  }, []);

  const handleActiveNoteChange = React.useCallback((noteId: UUID, value: string) => {
    setNoteDrafts((prev) => ({ ...prev, [noteId]: value }));
  }, []);

  const handleResetActiveNote = React.useCallback(() => {
    if (!activeNote) return;
    setNoteDrafts((prev) => ({ ...prev, [activeNote.id]: activeNote.text }));
    setNoteStatuses((prev) => ({ ...prev, [activeNote.id]: "idle" }));
  }, [activeNote]);

  const handleUpdateActiveNote = React.useCallback(async () => {
    if (!activeNote) return;
    const draft = (noteDrafts[activeNote.id] ?? "").trim();
    if (!draft) return;
    const previous = { ...activeNote };
    setNoteStatuses((prev) => ({ ...prev, [activeNote.id]: "updating" }));
    setNotesByCard((prev) => ({
      ...prev,
      [activeNote.cardId]: (prev[activeNote.cardId] ?? []).map((note) =>
        note.id === activeNote.id ? { ...note, text: draft } : note
      ),
    }));
    setNoteDrafts((prev) => ({ ...prev, [activeNote.id]: draft }));
    try {
      const res = await updateNoteApi(activeNote.id, { text: draft });
      setNotesByCard((prev) => ({
        ...prev,
        [activeNote.cardId]: (prev[activeNote.cardId] ?? []).map((note) =>
          note.id === activeNote.id ? { ...note, text: draft, updatedAt: res.updatedAt } : note
        ),
      }));
      setNoteStatuses((prev) => ({ ...prev, [activeNote.id]: "idle" }));
      workspaceStore.bumpVersion();
    } catch (error) {
      console.error(error);
      setNotesByCard((prev) => ({
        ...prev,
        [activeNote.cardId]: (prev[activeNote.cardId] ?? []).map((note) =>
          note.id === previous.id ? previous : note
        ),
      }));
      setNoteDrafts((prev) => ({ ...prev, [activeNote.id]: previous.text }));
      setNoteStatuses((prev) => ({ ...prev, [activeNote.id]: "idle" }));
    }
  }, [activeNote, noteDrafts]);

  const handleCreateNote = React.useCallback(async () => {
    if (selectedKind !== "card" || !selectedId) return;
    const draft = newNoteDraft.trim();
    if (!draft) return;
    const tempId = (`temp-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`) as UUID;
    const now = new Date().toISOString();
    const optimistic: Note = { id: tempId, cardId: selectedId, text: draft, createdAt: now, updatedAt: now };
    setNotesByCard((prev) => ({
      ...prev,
      [selectedId]: [optimistic, ...(prev[selectedId] ?? [])],
    }));
    setNoteDrafts((prev) => ({ ...prev, [tempId]: draft }));
    setNoteStatuses((prev) => ({ ...prev, [tempId]: "creating" }));
    setActiveNoteId(tempId);
    setNewNoteDraft("");
    try {
      const res = await createNoteApi(selectedId, draft);
      setNotesByCard((prev) => ({
        ...prev,
        [selectedId]: (prev[selectedId] ?? []).map((note) =>
          note.id === tempId
            ? { id: res.noteId, cardId: selectedId, text: draft, createdAt: res.createdAt, updatedAt: res.updatedAt }
            : note
        ),
      }));
      setNoteDrafts((prev) => {
        const next = { ...prev };
        delete next[tempId];
        next[res.noteId] = draft;
        return next;
      });
      setNoteStatuses((prev) => {
        const next = { ...prev };
        delete next[tempId];
        next[res.noteId] = "idle";
        return next;
      });
      setActiveNoteId(res.noteId);
      workspaceStore.bumpVersion();
    } catch (error) {
      console.error(error);
      setNotesByCard((prev) => ({
        ...prev,
        [selectedId]: (prev[selectedId] ?? []).filter((note) => note.id !== tempId),
      }));
      setNoteDrafts((prev) => {
        const next = { ...prev };
        delete next[tempId];
        return next;
      });
      setNoteStatuses((prev) => {
        const next = { ...prev };
        delete next[tempId];
        return next;
      });
      if (activeNoteId === tempId) {
        setActiveNoteId(null);
      }
    }
  }, [activeNoteId, newNoteDraft, selectedId, selectedKind]);

  const handleDeleteNote = React.useCallback(async (note: Note) => {
    const prevList = notesByCard[note.cardId] ?? [];
    const without = prevList.filter((n) => n.id !== note.id);
    setNoteStatuses((prev) => ({ ...prev, [note.id]: "deleting" }));
    setNotesByCard((prev) => ({ ...prev, [note.cardId]: without }));
    try {
      await deleteNoteApi(note.id);
      setNoteDrafts((prev) => {
        const next = { ...prev };
        delete next[note.id];
        return next;
      });
      setNoteStatuses((prev) => {
        const next = { ...prev };
        delete next[note.id];
        return next;
      });
      if (activeNoteId === note.id) {
        setActiveNoteId(without[0]?.id ?? null);
      }
      workspaceStore.bumpVersion();
    } catch (error) {
      console.error(error);
      setNotesByCard((prev) => ({ ...prev, [note.cardId]: prevList }));
      setNoteStatuses((prev) => ({ ...prev, [note.id]: "idle" }));
    }
  }, [activeNoteId, notesByCard]);

  const activeNoteStatusLabel = React.useMemo(() => {
    if (!activeNote) return "メモ未選択";
    if (activeNoteStatus === "creating") return "作成中…";
    if (activeNoteStatus === "updating") return "保存中…";
    if (activeNoteStatus === "deleting") return "削除中…";
    if (activeNoteDirty) return "未保存";
    return "保存済み";
  }, [activeNote, activeNoteDirty, activeNoteStatus]);

  const activeNoteCreatedLabel = activeNote ? formatNoteTime(activeNote.createdAt) : "-";
  const activeNoteUpdatedLabel = activeNote ? formatNoteTime(activeNote.updatedAt) : "-";
  const noteCount = currentCardNotes.length;
  const creatingInProgress = React.useMemo(() => Object.values(noteStatuses).some((status) => status === "creating"), [noteStatuses]);

  const cardSaveLabel = React.useMemo(() => {
    if (!form) return "-";
    if (saving === "saving") return "保存中…";
    if (dirty) return "未保存";
    if (saving === "saved") return savedAt ? `保存済み（${new Date(savedAt).toLocaleTimeString()}）` : "保存済み";
    return "-";
  }, [dirty, form, savedAt, saving]);

  // レッスン上部ツールはファイルスコープの安定コンポーネントに移動（下方で定義）

  return (
    <>
      <aside className="h-full min-h-0 overflow-auto p-3">
        <div className="text-xs text-gray-500 mb-2">インスペクタ</div>
        {currentLesson && (
          <LessonTools
            courseId={courseId}
            lesson={currentLesson}
            runningLesson={runningLesson}
            setRunningLesson={setRunningLesson}
            logsByLesson={logsByLesson}
            setLogsByLesson={setLogsByLesson}
            previews={previews}
            setPreviews={setPreviews}
            selectedIndexes={selectedIndexes}
            setSelectedIndexes={setSelectedIndexes}
            selectedKind={selectedKind}
            open={lessonToolsOpen}
            onOpenChange={setLessonToolsOpen}
            onSaveAll={async (lessonId, payload, selected) => {
              const idxs = Object.entries(selected).filter(([, v]) => v).map(([k]) => Number(k));
              const res = idxs.length > 0
                ? await commitLessonCardsPartialApi({ draftId: payload.draftId, lessonId, selectedIndexes: idxs })
                : await commitLessonCardsApi({ draftId: payload.draftId, lessonId });
              if (!res) return alert("保存に失敗しました");
              refreshLists();
              // 左ペイン（NavTree）のデータを即時更新させるため、外部ストアのバージョンを更新
              workspaceStore.bumpVersion();
              setPreviews((prev) => { const copy = { ...prev }; delete copy[lessonId]; return copy; });
            }}
            onRefresh={refreshLists}
          />
        )}
        {!selectedId && (
          <p className="text-sm text-gray-700">コースやレッスン/カードを選択してください。</p>
        )}

        {/* Course-level: レッスン管理 */}
        {!selectedId && course && (
          <CourseInspector course={course} lessons={lessons} onRefresh={refreshLists} />
        )}

      {/* Lesson-level: カード管理 + AI生成 */}
      {selectedKind === "lesson" && lesson && (
        <LessonInspector
          courseId={courseId}
          lesson={lesson}
          cards={cards}
          runningLesson={runningLesson}
          setRunningLesson={setRunningLesson}
          logsByLesson={logsByLesson}
          setLogsByLesson={setLogsByLesson}
          previews={previews}
          setPreviews={setPreviews}
          selectedIndexes={selectedIndexes}
          setSelectedIndexes={setSelectedIndexes}
          hideAiSection
          onRefresh={refreshLists}
        />
      )}
      {selectedKind === "card" && card && (
        <Accordion
          type="single"
          collapsible
          value={noteAccordionOpen ? "card-note" : ""}
          onValueChange={(value) => setNoteAccordionOpen(value === "card-note")}
          className="mb-3 rounded-md border border-[hsl(220_13%_85%_/_0.8)] bg-[hsl(var(--card))] shadow-sm"
        >
          <AccordionItem value="card-note" className="after:hidden">
            <AccordionTrigger className="px-3 py-3 text-sm font-medium">
              <div className="flex w-full items-center justify-between gap-2 text-left">
                <div className="flex items-center gap-2">
                  <span>カードメモ</span>
                  <Badge variant="secondary">{noteCount}</Badge>
                </div>
                <span className="text-xs text-muted-foreground">{activeNoteStatusLabel}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-3">
              <div className="text-xs text-gray-500 mb-3">カードごとの気付きや補足を複数保存できます。</div>
              <div className="grid gap-4 md:grid-cols-[minmax(220px,260px),1fr]">
                <Card className="flex h-full flex-col border-muted" data-testid="note-list-card">
                  <div className="flex items-center justify-between border-b px-4 py-3">
                    <span className="text-sm font-medium">メモ一覧</span>
                    <Badge variant="secondary">{noteCount}件</Badge>
                  </div>
                  <ScrollArea className="h-[38vh] min-h-[220px] md:h-[55vh]" data-testid="note-list-scroll">
                    <div className="space-y-2 p-3">
                      {noteCount === 0 ? (
                        <p className="text-sm text-muted-foreground">まだメモはありません。右側で新しいメモを追加できます。</p>
                      ) : (
                        currentCardNotes.map((note, index) => {
                          const status = noteStatuses[note.id] ?? "idle";
                          const isActive = activeNoteId === note.id;
                          const isDeleting = status === "deleting";
                          return (
                            <Card
                              key={note.id}
                              className={cn("cursor-pointer transition-colors", isActive ? "border-primary shadow-md" : "hover:border-primary/40")}
                              data-testid={`note-item-${note.id}`}
                              onClick={() => handleSelectNote(note.id)}
                            >
                              <div className="flex items-start justify-between gap-2 p-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Badge variant="secondary">#{index + 1}</Badge>
                                    <span>更新: {formatNoteTime(note.updatedAt)}</span>
                                  </div>
                                  <p className="mt-1 line-clamp-2 text-sm text-left">{note.text.trim() || "（空のメモ）"}</p>
                                </div>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      aria-label="メモメニュー"
                                      onClick={(event) => event.stopPropagation()}
                                    >
                                      {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onSelect={(event) => {
                                        event.preventDefault();
                                        setNoteToDelete(note);
                                      }}
                                    >
                                      削除
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </Card>
                          );
                        })
                      )}
                    </div>
                  </ScrollArea>
                </Card>
                <Card className="border-muted" data-testid="note-editor-card">
                  <div className="border-b px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">メモ編集</p>
                        {activeNote && (
                          <p className="text-xs text-muted-foreground">作成: {activeNoteCreatedLabel} / 更新: {activeNoteUpdatedLabel}</p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">状態: {activeNoteStatusLabel}</span>
                    </div>
                  </div>
                  <div className="space-y-3 p-4">
                    {activeNote ? (
                      <>
                        <Label htmlFor={existingNoteFieldId} className="text-sm font-medium">選択中のメモ</Label>
                        <Textarea
                          id={existingNoteFieldId}
                          value={activeNoteDraft}
                          onChange={(e) => handleActiveNoteChange(activeNote.id, e.target.value)}
                          disabled={activeNoteStatus === "deleting"}
                          rows={8}
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleResetActiveNote}
                            disabled={!activeNoteDirty || activeNoteStatus === "updating" || activeNoteStatus === "deleting"}
                          >リセット</Button>
                          <Button
                            size="sm"
                            onClick={() => { void handleUpdateActiveNote(); }}
                            disabled={!activeNoteDirty || activeNoteStatus === "updating" || activeNoteStatus === "deleting"}
                          >
                            {activeNoteStatus === "updating" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}保存
                          </Button>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">メモを選択するか、下で新しいメモを追加してください。</p>
                    )}
                    <div className="space-y-2 border-t pt-4">
                      <div className="flex items-center justify-between">
                        <Label htmlFor={newNoteFieldId} className="text-sm font-medium">新規メモ</Label>
                        <span className="text-xs text-muted-foreground">{creatingInProgress ? "作成中…" : ""}</span>
                      </div>
                      <Textarea
                        id={newNoteFieldId}
                        value={newNoteDraft}
                        onChange={(e) => setNewNoteDraft(e.target.value)}
                        placeholder="新しいメモの内容を入力…"
                        rows={4}
                        disabled={creatingInProgress}
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setNewNoteDraft("")}
                          disabled={!newNoteDraft || creatingInProgress}
                        >クリア</Button>
                        <Button
                          size="sm"
                          onClick={() => { void handleCreateNote(); }}
                          disabled={creatingInProgress || !newNoteDraft.trim()}
                        >
                          {creatingInProgress ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}追加
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
              <AlertDialog open={noteToDelete !== null} onOpenChange={(open) => { if (!open) setNoteToDelete(null); }}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>メモを削除しますか？</AlertDialogTitle>
                    <AlertDialogDescription>削除すると元に戻せません。</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>キャンセル</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        if (noteToDelete) {
                          void handleDeleteNote(noteToDelete);
                        }
                        setNoteToDelete(null);
                      }}
                      disabled={noteToDelete ? (noteStatuses[noteToDelete.id] === "deleting") : false}
                    >削除する</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
      {selectedKind === "card" && card && form && (
        <Accordion
          type="single"
          collapsible
          value={cardEditorOpen ? "card-editor" : ""}
          onValueChange={(value) => setCardEditorOpen(value === "card-editor")}
          className="rounded-md border border-[hsl(220_13%_85%_/_0.8)] bg-[hsl(var(--card))] shadow-sm"
        >
          <AccordionItem value="card-editor" className="after:hidden">
            <AccordionTrigger className="px-3 py-3 text-sm font-medium">
              <div className="flex w-full flex-col items-start gap-1 text-left">
                <div className="flex w-full items-center justify-between gap-2 text-sm font-medium">
                  <span>カード編集</span>
                  <span className="text-xs text-muted-foreground">タイプ: {form.cardType}</span>
                </div>
                <span className="text-xs text-muted-foreground">保存: {cardSaveLabel}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 px-3">
              <div className="text-xs text-gray-500" aria-live="polite">
                タイプ: {form.cardType} / 保存: {cardSaveLabel}
              </div>
              <div>
                <label className="block text-sm mb-1">タイトル（任意）</label>
                <Input
                  value={form.title ?? ""}
                  onChange={(e) => {
                    applyDraftUpdate((current) => ({ ...current, title: e.target.value }));
                  }}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">タグ（カンマ区切り）</label>
                <Input
                  value={(form.tags ?? []).join(", ")}
                  onChange={(e) => {
                    applyDraftUpdate((current) => {
                      const tags = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
                      return { ...current, tags };
                    });
                  }}
                  placeholder="例: 基礎, 重要, 用語"
                />
              </div>
              {form.cardType === "text" && (
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="block text-sm">本文</label>
                    <div className="flex items-center gap-2">
                      {card && (
                        <Button asChild size="sm" variant="default">
                          <Link
                            href={`/courses/${courseId}/edit/${card.id}`}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const navigate = () => {
                                if (form) {
                                  workspaceStore.clearDraft(form.cardId);
                                  workspaceStore.bumpVersion();
                                  setDirty(false);
                                }
                                router.push(`/courses/${courseId}/edit/${card.id}`);
                              };
                              requestDiscard(navigate);
                            }}
                          >
                            編集モードで開く
                          </Link>
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setRichMode((v) => !v)}
                        aria-pressed={richMode}
                      >
                        {richMode ? "素のMarkdown" : "軽量編集"}
                      </Button>
                    </div>
                  </div>
                  {richMode ? (
                    <Textarea
                      value={form.body ?? ""}
                      onChange={(e) => {
                        applyDraftUpdate((current) => {
                          if (current.cardType !== "text") return current;
                          return { ...current, body: e.target.value };
                        });
                      }}
                      placeholder="Markdown を記述…"
                    />
                  ) : (
                    <Textarea
                      value={form.body ?? ""}
                      onChange={(e) => {
                        applyDraftUpdate((current) => {
                          if (current.cardType !== "text") return current;
                          return { ...current, body: e.target.value };
                        });
                      }}
                      placeholder="Markdown を記述…"
                    />
                  )}
                </div>
              )}
              {form.cardType === "quiz" && (
                <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="inspector-quiz-question" className="text-sm font-medium">
                  設問
                </Label>
                <Input
                  id="inspector-quiz-question"
                  value={form.question ?? ""}
                  onChange={(e) => updateQuizForm((draft) => ({ ...draft, question: e.target.value }))}
                />
              </div>
              <div className="space-y-3">
                {(form.options ?? []).map((opt, idx) => {
                  const optionId = `${quizFieldIdBase}-option-${idx}`;
                  const explanationId = `${quizFieldIdBase}-explanation-${idx}`;
                  const isCorrect = form.answerIndex === idx;
                  return (
                    <Card key={optionId} className="p-3 space-y-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <Label htmlFor={optionId} className="text-sm font-medium">
                          {`選択肢 ${idx + 1}`}
                        </Label>
                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          <Button
                            type="button"
                            size="sm"
                            variant={isCorrect ? "default" : "outline"}
                            onClick={() => handleQuizSetCorrect(idx)}
                            aria-pressed={isCorrect}
                          >
                            {isCorrect ? (
                              <>
                                <Check className="size-4" />
                                正解
                              </>
                            ) : (
                              "正解にする"
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleQuizRemoveOption(idx)}
                            disabled={(form.options ?? []).length <= 2}
                          >
                            <Trash2 className="size-4" />
                            <span className="sr-only">{`選択肢${idx + 1}を削除`}</span>
                          </Button>
                        </div>
                      </div>
                      <Input
                        id={optionId}
                        value={opt}
                        onChange={(e) => handleQuizOptionChange(idx, e.target.value)}
                        placeholder="選択肢を入力"
                      />
                      <div className="space-y-2">
                        <Label htmlFor={explanationId} className="text-xs font-medium text-muted-foreground">
                          {`選択肢${idx + 1}の解説`}
                        </Label>
                        <Textarea
                          id={explanationId}
                          value={form.optionExplanations?.[idx] ?? ""}
                          onChange={(e) => handleQuizExplanationChange(idx, e.target.value)}
                          placeholder="この選択肢を選んだ学習者への解説"
                        />
                      </div>
                    </Card>
                  );
                })}
                <Button type="button" variant="outline" onClick={handleQuizAddOption} className="w-full sm:w-auto">
                  <Plus className="size-4" />
                  選択肢を追加
                </Button>
              </div>
              <div className="space-y-2">
                <Label htmlFor="inspector-quiz-explanation" className="text-sm font-medium">
                  全体の解説
                </Label>
                <Textarea
                  id="inspector-quiz-explanation"
                  value={form.explanation ?? ""}
                  onChange={(e) => updateQuizForm((draft) => ({ ...draft, explanation: e.target.value }))}
                  placeholder="全体の解説"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inspector-quiz-hint" className="text-sm font-medium">
                  ヒント（学習者が正解を見る前に表示）
                </Label>
                <Textarea
                  id="inspector-quiz-hint"
                  value={form.hint ?? ""}
                  onChange={(e) => updateQuizForm((draft) => ({ ...draft, hint: e.target.value }))}
                  placeholder="答えを直接示さずに導くヒントを記述"
                />
              </div>
            </div>
          )}
          {form.cardType === "fill-blank" && (
            <div className="grid grid-cols-1 gap-2">
              <div>
                <label className="block text-sm mb-1">テキスト（[[1]] 形式）</label>
                <Textarea
                  value={form.cardType === "fill-blank" ? form.text : ""}
                  onChange={(e) => {
                    applyDraftUpdate((current) => {
                      if (current.cardType !== "fill-blank") return current;
                      return { ...current, text: e.target.value };
                    });
                  }}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">回答（k:value 改行区切り）</label>
                <Textarea
                  value={answersText}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setAnswersText(raw);
                    const obj: Record<string, string> = {};
                    raw.split("\n").forEach((line) => {
                      const s = line.trim();
                      if (!s) return;
                      const [k, ...rest] = s.split(":");
                      const v = rest.join(":");
                      if (!k) return;
                      obj[k.trim()] = v ?? "";
                    });
                    applyDraftUpdate((current) => {
                      if (current.cardType !== "fill-blank") return current;
                      return { ...current, answers: obj };
                    });
                  }}
                />
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button onClick={async () => { try { await handleSave(); } catch {} }} disabled={!dirty || saving === "saving"}>保存</Button>
          </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
      {course && (
        <section className="mt-4">
          <h4 className="font-medium text-sm">コース</h4>
          <div className="text-sm">{course.title}</div>
        </section>
      )}
      </aside>
      <AlertDialog open={pendingAction != null} onOpenChange={(open: boolean) => { if (!open) setPendingAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>保存されていない変更があります</AlertDialogTitle>
            <AlertDialogDescription>
              保存せずに移動すると変更が失われます。移動してもよろしいですか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingAction(null)}>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const action = pendingAction;
                setPendingAction(null);
                action?.();
              }}
            >
              保存せずに移動
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

type LessonToolsProps = {
  lesson: Lesson;
  runningLesson: Lesson | null;
  setRunningLesson: (l: Lesson | null) => void;
  logsByLesson: Record<string, { ts: number; text: string }[]>;
  setLogsByLesson: React.Dispatch<React.SetStateAction<Record<string, { ts: number; text: string }[]>>>;
  previews: Record<string, { draftId: string; payload: LessonCards }>;
  setPreviews: React.Dispatch<React.SetStateAction<Record<string, { draftId: string; payload: LessonCards }>>>;
  selectedIndexes: Record<string, Record<number, boolean>>;
  setSelectedIndexes: React.Dispatch<React.SetStateAction<Record<string, Record<number, boolean>>>>;
  onSaveAll: (lessonId: UUID, payload: { draftId: string; payload: LessonCards }, selected: Record<number, boolean>) => void;
  onRefresh: () => void;
  selectedKind?: "lesson" | "card";
  courseId: UUID;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function LessonTools({ courseId, lesson, runningLesson, setRunningLesson, logsByLesson, setLogsByLesson, previews, setPreviews, selectedIndexes, setSelectedIndexes, onSaveAll, onRefresh, selectedKind, open, onOpenChange }: LessonToolsProps) {
  const [aiMode, setAiMode] = React.useState<"batch" | "single">("batch");
  const [batchType, setBatchType] = React.useState<CardType>("text");
  const [runningBatchType, setRunningBatchType] = React.useState<CardType | null>(null);
  // 実行開始時点のモードをロックして保持（実行中のモード変更で再マウントさせない）
  const [runningMode, setRunningMode] = React.useState<"batch" | "single" | null>(null);
  const isRunning = !!runningLesson && runningLesson.id === lesson.id;
  // 単体生成オプション
  const [singleType, setSingleType] = React.useState<CardType>("text");
  const [singleBrief, setSingleBrief] = React.useState("");
  // 左ペインの選択に応じて既定値を切替（レッスン=一式 / カード=単体）。実行中は変更しない。
  React.useEffect(() => {
    if (isRunning) return; // 実行中は現在の選択に影響させない
    setAiMode(selectedKind === "card" ? "single" : "batch");
    setRunningBatchType(null);
  }, [selectedKind, lesson.id, isRunning]);
  const effectiveBatchType = runningBatchType ?? batchType;
  const accordionValue = open ? "lesson-tools" : "";
  return (
    <Accordion
      type="single"
      collapsible
      value={accordionValue}
      onValueChange={(value) => onOpenChange(value === "lesson-tools")}
      className="mb-4 rounded-md border border-[hsl(220_13%_85%_/_0.8)] bg-[hsl(var(--card))] shadow-sm hover:border-[hsl(220_13%_80%)] transition-all duration-200"
    >
      <AccordionItem value="lesson-tools" className="after:hidden">
        <AccordionTrigger className="px-4 py-3 text-sm font-medium">
          <div className="flex w-full flex-col items-start gap-1 text-left">
            <div className="flex w-full items-center justify-between gap-2">
              <span>レッスンツール</span>
              <span className="text-xs text-muted-foreground truncate max-w-[65%] md:max-w-[55%]" title={lesson.title}>
                {lesson.title}
              </span>
            </div>
            {isRunning && <span className="text-xs text-primary">生成中…</span>}
          </div>
        </AccordionTrigger>
        <AccordionContent className="space-y-3 px-4 pb-4">
          <div className="space-y-3">
            <div className="flex flex-col gap-2 md:flex-row md:items-end">
              <div className="flex w-full flex-col gap-1 md:w-56">
                <Label className="text-xs text-gray-600">AIモード</Label>
                <SelectMenu value={aiMode} onValueChange={(v) => setAiMode(v as "batch" | "single")}>
                  <SelectMenuTrigger className="h-10 w-full" disabled={isRunning}>
                    <SelectMenuValue placeholder="AIモードを選択" />
                  </SelectMenuTrigger>
                  <SelectMenuContent>
                    <SelectMenuItem value="batch">カード一式をAI生成</SelectMenuItem>
                    <SelectMenuItem value="single">カード単体をAI生成</SelectMenuItem>
                  </SelectMenuContent>
                </SelectMenu>
              </div>
              {aiMode === "batch" && (
                <div className="flex flex-col gap-1 md:flex-1">
                  <Label className="text-xs text-gray-600">カードタイプ</Label>
                  <ToggleGroup
                    type="single"
                    value={batchType}
                    onValueChange={(v) => { if (!v || isRunning) return; setBatchType(v as CardType); }}
                    className={cn("w-full", isRunning && "pointer-events-none opacity-60")}
                  >
                    <ToggleGroupItem value="text" className="flex-1">テキスト</ToggleGroupItem>
                    <ToggleGroupItem value="quiz" className="flex-1">クイズ</ToggleGroupItem>
                    <ToggleGroupItem value="fill-blank" className="flex-1">穴埋め</ToggleGroupItem>
                  </ToggleGroup>
                </div>
              )}
            </div>
            {aiMode === "single" && !isRunning && (
              <div className="grid grid-cols-1 gap-2">
                <div>
                  <Label className="mb-1 block text-xs text-gray-600">カードタイプ</Label>
                  <SelectMenu value={singleType} onValueChange={(v) => setSingleType(v as CardType)}>
                    <SelectMenuTrigger className="h-9 w-full">
                      <SelectMenuValue placeholder="カードタイプを選択" />
                    </SelectMenuTrigger>
                    <SelectMenuContent>
                      <SelectMenuItem value="text">Text</SelectMenuItem>
                      <SelectMenuItem value="quiz">Quiz</SelectMenuItem>
                      <SelectMenuItem value="fill-blank">Fill‑blank</SelectMenuItem>
                    </SelectMenuContent>
                  </SelectMenu>
                </div>
                <div>
                  <Label className="mb-1 block text-xs text-gray-600">カードの概要（任意）</Label>
                  <Textarea
                    value={singleBrief}
                    onChange={(e) => setSingleBrief(e.target.value)}
                    placeholder="例: 変数の定義と型注釈について要点を説明（学習者は初学者想定）"
                  />
                </div>
              </div>
            )}
            <div className="w-full">
              <Button
                className="h-10 w-full"
                size="default"
                onClick={() => {
                  setRunningMode(aiMode);
                  if (aiMode === "batch") setRunningBatchType(batchType);
                  setRunningLesson(lesson);
                }}
                disabled={isRunning}
              >
                {runningLesson?.id === lesson.id ? "生成中…" : "AIで生成"}
              </Button>
            </div>
          </div>
          {isRunning && (
            (runningMode ?? aiMode) === "batch" ? (
              <LessonCardsRunner
                courseId={courseId}
                lessonId={lesson.id}
                lessonTitle={lesson.title}
                desiredCardType={effectiveBatchType}
                onLog={(id, text) => setLogsByLesson((m) => ({ ...m, [id]: [...(m[id] ?? []), { ts: Date.now(), text }] }))}
                onPreview={(id, draftId, payload) => setPreviews((prev) => ({ ...prev, [id]: { draftId, payload } }))}
                onFinish={() => { setRunningLesson(null); setRunningMode(null); setRunningBatchType(null); onRefresh(); workspaceStore.bumpVersion(); }}
              />
            ) : (
              <SingleCardRunner
                courseId={courseId}
                lessonId={lesson.id}
                lessonTitle={lesson.title}
                desiredCardType={singleType}
                userBrief={singleBrief}
                onLog={(id, text) => setLogsByLesson((m) => ({ ...m, [id]: [...(m[id] ?? []), { ts: Date.now(), text }] }))}
                onPreview={(id, draftId, payload) => setPreviews((prev) => ({ ...prev, [id]: { draftId, payload } }))}
                onFinish={() => { setRunningLesson(null); setRunningMode(null); setRunningBatchType(null); onRefresh(); workspaceStore.bumpVersion(); }}
              />
            )
          )}
          <div className="pt-1 md:pt-2">
            <SSETimeline layout="inline" size="compact" logs={logsByLesson[lesson.id] ?? []} />
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

// (unused) summary helper was removed to reduce lint warnings

// --- Sub-components -------------------------------------------------------

function CourseInspector({ course, lessons, onRefresh }: { course: Course; lessons: Lesson[]; onRefresh: () => void }) {
  const [title, setTitle] = React.useState("");
  React.useEffect(() => setTitle(""), [course.id]);
  return (
    <section className="space-y-3">
      <h3 className="font-medium">コース: {course.title}</h3>
      <div className="flex gap-2">
        <Input placeholder="新規レッスン名" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Button onClick={async () => { if (!title.trim()) return; await addLessonApi(course.id, title); setTitle(""); onRefresh(); workspaceStore.bumpVersion(); }}>レッスン追加</Button>
      </div>
      <div>
        <h4 className="text-sm text-gray-700 mb-2">レッスン並び替え</h4>
        <SortableList
          ids={lessons.map((l) => l.id)}
          label="レッスンの並び替え"
          onReorder={async (ids) => { await reorderLessonsApi(course.id, ids); onRefresh(); workspaceStore.bumpVersion(); }}
          renderItem={(id) => {
            const l = lessons.find((x) => x.id === id);
            if (!l) return <div className="text-xs text-gray-400">更新中…</div>;
            return (
              <div className="flex items-center gap-2">
                <span className="flex-1 truncate">{l.title}</span>
                <Confirm
                  title="このレッスンを削除しますか？"
                  description="この操作は元に戻せません。配下のカードも削除されます。"
                  confirmLabel="削除する"
                  cancelLabel="キャンセル"
                  onConfirm={async () => { await deleteLessonApi(l.id); onRefresh(); workspaceStore.bumpVersion(); }}
                >
                  <Button variant="destructive" size="sm">削除</Button>
                </Confirm>
              </div>
            );
          }}
        />
      </div>
    </section>
  );
}

function LessonInspector(props: {
  courseId: UUID;
  lesson: Lesson;
  cards: WorkspaceCard[];
  runningLesson: Lesson | null;
  setRunningLesson: (l: Lesson | null) => void;
  logsByLesson: Record<string, { ts: number; text: string }[]>;
  setLogsByLesson: React.Dispatch<React.SetStateAction<Record<string, { ts: number; text: string }[]>>>;
  previews: Record<string, { draftId: string; payload: LessonCards }>;
  setPreviews: React.Dispatch<React.SetStateAction<Record<string, { draftId: string; payload: LessonCards }>>>;
  selectedIndexes: Record<string, Record<number, boolean>>;
  setSelectedIndexes: React.Dispatch<React.SetStateAction<Record<string, Record<number, boolean>>>>;
  hideAiSection?: boolean;
  onRefresh: () => void;
}) {
  const { lesson, cards, runningLesson, setRunningLesson, logsByLesson, setLogsByLesson, previews, setPreviews, selectedIndexes, setSelectedIndexes, hideAiSection, onRefresh } = props;

  // AI SSE runner
  // Note: do NOT define inline components here to avoid remount loops.

  return (
    <section className="space-y-4">
      <h3 className="font-medium">レッスン: {lesson.title}</h3>

      {/* AI 生成（上部 LessonTools と重複させないオプション） */}
      {!hideAiSection && (
      <div className="rounded-md border border-[hsl(220_13%_85%_/_0.8)] bg-[hsl(var(--card))] p-3 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm text-gray-700">AIでこのレッスンのカードを生成</div>
          <Button size="sm" onClick={() => setRunningLesson(lesson)} disabled={!!runningLesson && runningLesson.id === lesson.id}>
            {runningLesson?.id === lesson.id ? "生成中…" : "AIで生成"}
          </Button>
        </div>
        {runningLesson?.id === lesson.id && (
          <LessonCardsRunner
            courseId={props.courseId}
            lessonId={lesson.id}
            lessonTitle={lesson.title}
            desiredCardType="text"
            onLog={(id, text) => setLogsByLesson((m) => ({ ...m, [id]: [...(m[id] ?? []), { ts: Date.now(), text }] }))}
            onPreview={(id, draftId, payload) => setPreviews((prev) => ({ ...prev, [id]: { draftId, payload } }))}
            onFinish={() => { setRunningLesson(null); onRefresh(); workspaceStore.bumpVersion(); }}
          />
        )}
        <SSETimeline layout="inline" size="compact" logs={logsByLesson[lesson.id] ?? []} />
        {/* プレビュー表示は要件により廃止 */}
      </div>
      )}

      {/* 手動でカード追加（開閉可能） */}
      <div className="rounded-md border border-[hsl(220_13%_85%_/_0.8)] bg-[hsl(var(--card))] shadow-sm overflow-hidden">
        <Accordion type="single" collapsible>
          <AccordionItem value="new-card" className="after:hidden">
            <AccordionTrigger className="px-3 py-3 text-sm font-medium">
              新規カードを作成
            </AccordionTrigger>
            <AccordionContent className="px-3">
              <NewCardForm lessonId={lesson.id} onDone={onRefresh} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      {/* カード一覧（並び替え/削除） */}
      <div>
        <h4 className="text-sm text-gray-700 mb-2">カード一覧</h4>
        {cards.length === 0 ? (
          <p className="text-sm text-gray-600">カードがありません。</p>
        ) : (
          <SortableList
            ids={cards.map((c) => c.id)}
            label="カードの並び替え"
            onReorder={async (ids) => { await reorderCardsApi(lesson.id, ids); onRefresh(); workspaceStore.bumpVersion(); }}
            renderItem={(id) => {
              const c = cards.find((x) => x.id === id);
              if (!c) return <div className="text-xs text-gray-400">更新中…</div>;
              return (
                <div className="flex items-center gap-2">
                  <span className="px-1 py-0.5 rounded bg-black/5 text-xs">{c.cardType}</span>
                  <span className="flex-1 truncate">{c.title || labelCard(c)}</span>
                  <Confirm
                    title="このカードを削除しますか？"
                    description="この操作は元に戻せません。学習履歴も削除されます。"
                    confirmLabel="削除する"
                    cancelLabel="キャンセル"
                    onConfirm={async () => { await deleteCardApi(c.id); onRefresh(); workspaceStore.bumpVersion(); }}
                  >
                    <Button variant="destructive" size="sm">削除</Button>
                  </Confirm>
                </div>
              );
            }}
          />
        )}
      </div>
    </section>
  );
}

function labelCard(card: WorkspaceCard): string {
  if (card.cardType === "text") return (card.content as TextCardContent).body?.slice(0, 18) ?? "テキスト";
  if (card.cardType === "quiz") return (card.content as QuizCardContent).question ?? "クイズ";
  return (card.content as FillBlankCardContent).text?.replace(/\[\[(\d+)\]\]/g, "□") ?? "穴埋め";
}

function NewCardForm({ lessonId, onDone }: { lessonId: UUID; onDone: () => void }) {
  const [type, setType] = React.useState<CardType>("text");
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [question, setQuestion] = React.useState("");
  const [options, setOptions] = React.useState("");
  const [answerIndex, setAnswerIndex] = React.useState(0);
  const [explanation, setExplanation] = React.useState("");
  const [text, setText] = React.useState("");
  const [answers, setAnswers] = React.useState("1:answer");
  const [caseSensitive, setCaseSensitive] = React.useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (type === "text") {
          if (!body.trim()) return alert("本文は必須です");
          await addCardApi(lessonId, { cardType: "text", title: title || null, content: { body } });
        } else if (type === "quiz") {
          const opts = options.split("\n").map((s) => s.trim()).filter(Boolean);
          if (!question.trim() || opts.length < 2) return alert("設問と選択肢2つ以上が必要です");
          await addCardApi(lessonId, { cardType: "quiz", title: title || null, content: { question, options: opts, answerIndex: Math.max(0, Math.min(answerIndex, opts.length - 1)), explanation: explanation || undefined } });
        } else {
          const obj: Record<string, string> = {};
          answers.split("\n").map((s) => s.trim()).filter(Boolean).forEach((line) => {
            const [k, ...rest] = line.split(":");
            const v = rest.join(":").trim();
            if (k && v) obj[k.trim()] = v;
          });
          if (!text.trim() || Object.keys(obj).length === 0) return alert("テキストと回答（例: 1:answer）を入力してください");
          await addCardApi(lessonId, { cardType: "fill-blank", title: title || null, content: { text, answers: obj, caseSensitive } });
        }
        setTitle(""); setBody(""); setQuestion(""); setOptions(""); setAnswerIndex(0); setExplanation(""); setText(""); setAnswers("1:answer"); setCaseSensitive(false);
        onDone();
        // 左ペインへ即時反映
        workspaceStore.bumpVersion();
      }}
      className="space-y-3"
    >
      <div>
        <Label className="mb-1 block">タイトル（任意）</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="タイトル（任意）" className="w-full" />
      </div>
      <div>
        <Label className="mb-1 block">タイプ</Label>
        <Select value={type} onChange={(e) => setType(e.target.value as CardType)} className="w-full max-w-[200px]">
          <option value="text">Text</option>
          <option value="quiz">Quiz</option>
          <option value="fill-blank">Fill‑blank</option>
        </Select>
      </div>
      {type === "text" && (
        <div>
          <label className="block text-sm mb-1">本文</label>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
      )}
      {type === "quiz" && (
        <div className="grid grid-cols-1 gap-2">
          <div>
            <label className="block text-sm mb-1">設問</label>
            <Input value={question} onChange={(e) => setQuestion(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm mb-1">選択肢（改行区切り）</label>
            <Textarea value={options} onChange={(e) => setOptions(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm mb-1">正解インデックス（0開始）</label>
            <Input type="number" value={answerIndex} onChange={(e) => setAnswerIndex(Number(e.target.value))} />
          </div>
          <div>
            <label className="block text-sm mb-1">解説（任意）</label>
            <Input value={explanation} onChange={(e) => setExplanation(e.target.value)} />
          </div>
        </div>
      )}
      {type === "fill-blank" && (
        <div className="grid grid-cols-1 gap-2">
          <div>
            <label className="block text-sm mb-1">テキスト（[[1]] の形式で空所）</label>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm mb-1">回答（例: 1:answer 改行区切り）</label>
            <Textarea value={answers} onChange={(e) => setAnswers(e.target.value)} />
          </div>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={caseSensitive} onChange={(e) => setCaseSensitive(e.target.checked)} />
            <span className="text-sm">大文字小文字を区別</span>
          </label>
        </div>
      )}
      <div className="flex justify-end">
        <Button type="submit">追加</Button>
      </div>
    </form>
  );
}
