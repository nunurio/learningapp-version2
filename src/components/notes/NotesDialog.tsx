"use client";
import * as React from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
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
import { Loader2, Plus, Trash2 } from "lucide-react";
import type { Note, UUID } from "@/lib/types";
import * as clientApi from "@/lib/client-api";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils/cn";

export type NotesDialogProps = {
  cardId: UUID;
  trigger?: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  context?: "learn" | "workspace";
  onNotesChange?: (notes: Note[]) => void;
  title?: string;
  description?: string;
};

type NoteDraftState = Record<string, string>;
type NoteFlagState = Record<string, boolean>;
type FocusTarget = UUID | "new" | null;

export function NotesDialog({
  cardId,
  trigger,
  open: controlledOpen,
  defaultOpen,
  onOpenChange,
  onNotesChange,
  context = "workspace",
  title = "ノート",
  description = context === "learn" ? "カードごとのメモを追加・編集できます。" : "このカードに紐づくメモを管理できます。",
}: NotesDialogProps) {
  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen ?? false);
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange]
  );
  const [loading, setLoading] = React.useState(false);
  const [notes, setNotes] = React.useState<Note[]>([]);
  const [noteDrafts, setNoteDrafts] = React.useState<NoteDraftState>({});
  const [saving, setSaving] = React.useState<NoteFlagState>({});
  const [deleting, setDeleting] = React.useState<NoteFlagState>({});
  const [creating, setCreating] = React.useState(false);
  const [newDraft, setNewDraft] = React.useState("");
  const [pendingFocus, setPendingFocus] = React.useState<FocusTarget>(null);
  const [activeNoteId, setActiveNoteId] = React.useState<UUID | null>(null);
  const activeTextareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const newNoteRef = React.useRef<HTMLTextAreaElement | null>(null);

  const sortNotes = React.useCallback((input: Note[]): Note[] => {
    return [...input].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, []);

  const loadNotes = React.useCallback(async () => {
    setLoading(true);
    try {
      const fetched = await clientApi.listNotes(cardId);
      const sorted = sortNotes(fetched);
      setNotes(sorted);
      setNoteDrafts(sorted.reduce<NoteDraftState>((acc, note) => {
        acc[note.id] = note.text;
        return acc;
      }, {}));
      setTimeout(() => {
        setPendingFocus(sorted[0]?.id ?? "new");
      }, 0);
    } catch (error) {
      console.error("Failed to load notes", error);
      toast({
        variant: "destructive",
        title: "メモの読み込みに失敗しました",
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setLoading(false);
    }
  }, [cardId, sortNotes]);

  React.useEffect(() => {
    if (!open) return;
    void loadNotes();
  }, [open, cardId, loadNotes]);

  React.useEffect(() => {
    if (!pendingFocus) return;
    if (pendingFocus === "new") {
      const el = newNoteRef.current;
      if (el) {
        const len = el.value.length;
        el.focus();
        el.setSelectionRange(len, len);
        setPendingFocus(null);
      }
      return;
    }
    if (pendingFocus === activeNoteId && activeTextareaRef.current) {
      const el = activeTextareaRef.current;
      const len = el.value.length;
      el.focus();
      el.setSelectionRange(len, len);
      setPendingFocus(null);
      return;
    }
  }, [pendingFocus, activeNoteId]);

  React.useEffect(() => {
    if (!open) {
      setActiveNoteId(null);
      return;
    }
    if (notes.length === 0) {
      setActiveNoteId(null);
      return;
    }
    if (!activeNoteId || !notes.some((note) => note.id === activeNoteId)) {
      const next = notes[0]?.id ?? null;
      setActiveNoteId(next);
      if (next) {
        setPendingFocus(next);
      }
    }
  }, [open, notes, activeNoteId]);

  const handleSave = React.useCallback(async (noteId: UUID) => {
    const draft = (noteDrafts[noteId] ?? "").trim();
    if (!draft) return;
    setSaving((state) => ({ ...state, [noteId]: true }));
    try {
      const { updatedAt } = await clientApi.updateNote(noteId, { text: draft });
      setNotes((prev) => prev.map((note) => note.id === noteId ? { ...note, text: draft, updatedAt } : note));
      setNoteDrafts((state) => ({ ...state, [noteId]: draft }));
    } catch (error) {
      console.error("Failed to update note", error);
      toast({
        variant: "destructive",
        title: "メモの保存に失敗しました",
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setSaving((state) => ({ ...state, [noteId]: false }));
    }
  }, [noteDrafts]);

  const handleCreate = React.useCallback(async () => {
    const text = newDraft.trim();
    if (!text) return;
    setCreating(true);
    try {
      const created = await clientApi.createNote(cardId, text);
      const newNote: Note = {
        id: created.noteId,
        cardId,
        text,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      };
      setNotes((prev) => sortNotes([newNote, ...prev]));
      setNoteDrafts((state) => ({ ...state, [newNote.id]: text }));
      setNewDraft("");
      setActiveNoteId(newNote.id);
      setPendingFocus(newNote.id);
    } catch (error) {
      console.error("Failed to create note", error);
      toast({
        variant: "destructive",
        title: "メモの追加に失敗しました",
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setCreating(false);
    }
  }, [cardId, newDraft, sortNotes]);

  const handleDelete = React.useCallback(async (noteId: UUID) => {
    setDeleting((state) => ({ ...state, [noteId]: true }));
    try {
      await clientApi.deleteNote(noteId);
      setNotes((prev) => {
        const filtered = prev.filter((note) => note.id !== noteId);
        if (noteId === activeNoteId) {
          const next = filtered[0]?.id ?? null;
          setActiveNoteId(next);
          setPendingFocus(next ?? "new");
        }
        return filtered;
      });
      setNoteDrafts((state) => {
        const next = { ...state };
        delete next[noteId];
        return next;
      });
    } catch (error) {
      console.error("Failed to delete note", error);
      toast({
        variant: "destructive",
        title: "メモの削除に失敗しました",
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setDeleting((state) => ({ ...state, [noteId]: false }));
    }
  }, []);

  React.useEffect(() => {
    if (!onNotesChange) return;
    onNotesChange(notes);
  }, [notes, onNotesChange]);

  const dirty = React.useMemo(() => {
    return Object.fromEntries(notes.map((note) => [note.id, (noteDrafts[note.id] ?? "") !== note.text]));
  }, [notes, noteDrafts]);

  const activeNote = React.useMemo(() => {
    if (!activeNoteId) return null;
    return notes.find((note) => note.id === activeNoteId) ?? null;
  }, [notes, activeNoteId]);

  const activeDraft = activeNote ? noteDrafts[activeNote.id] ?? "" : "";
  const isActiveDirty = activeNote ? dirty[activeNote.id] : false;
  const isActiveSaving = activeNote ? saving[activeNote.id] ?? false : false;
  const isActiveDeleting = activeNote ? deleting[activeNote.id] ?? false : false;

  const handleTextareaKey = React.useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>, noteId?: UUID) => {
    if (event.key === "Enter" && !event.shiftKey && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      if (noteId) {
        void handleSave(noteId);
      } else {
        void handleCreate();
      }
    }
  }, [handleCreate, handleSave]);

  const content = (
    <DialogContent className="sm:max-w-4xl" onOpenAutoFocus={(e) => e.preventDefault()}>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      {loading ? (
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> 読み込み中…
        </div>
      ) : (
        <div className="space-y-4" data-testid="notes-dialog-content">
          <div className="grid gap-4 md:grid-cols-[260px_1fr]">
            <div className="space-y-3" data-testid="notes-dialog-list">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-muted-foreground">メモ一覧</span>
                <span className="text-xs text-muted-foreground">{notes.length} 件</span>
              </div>
              <ScrollArea className="h-[360px] pr-3">
                <div className="space-y-2 py-1">
                  {notes.length === 0 ? (
                    <p className="px-1 text-sm text-muted-foreground">まだメモはありません。</p>
                  ) : (
                    notes.map((note) => {
                      const isDirty = dirty[note.id];
                      const isActive = activeNoteId === note.id;
                      return (
                        <button
                          key={note.id}
                          type="button"
                          data-testid="notes-dialog-item"
                          onClick={() => {
                            setActiveNoteId(note.id);
                            setPendingFocus(note.id);
                          }}
                          className={cn(
                            "w-full rounded-md border px-3 py-2 text-left text-sm transition",
                            isActive ? "border-primary bg-primary/5" : "border-muted bg-background hover:bg-muted"
                          )}
                        >
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{formatTimestamp(note.createdAt)}</span>
                            {isDirty ? <span className="text-amber-600">未保存</span> : <span>{formatTimestamp(note.updatedAt)}</span>}
                          </div>
                          <p className="mt-2 line-clamp-2 text-foreground">
                            {note.text.trim() ? note.text : "（空のメモ）"}
                          </p>
                        </button>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </div>
            <div className="space-y-4">
              <Card data-testid="notes-dialog-detail">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">メモ詳細</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {activeNote ? (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>作成: {formatTimestamp(activeNote.createdAt)}</span>
                        <span>更新: {formatTimestamp(activeNote.updatedAt)}</span>
                      </div>
                      <Textarea
                        ref={activeTextareaRef}
                        value={activeDraft}
                        onChange={(event) => {
                          const value = event.target.value;
                          setNoteDrafts((state) => ({ ...state, [activeNote.id]: value }));
                        }}
                        placeholder="メモ…"
                        rows={6}
                        onKeyDown={(event) => handleTextareaKey(event, activeNote.id)}
                      />
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">編集するメモを左の一覧から選択してください。</p>
                  )}
                </CardContent>
                <CardFooter className="flex justify-end gap-2 pt-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (!activeNote) return;
                      setNoteDrafts((state) => ({ ...state, [activeNote.id]: activeNote.text }));
                    }}
                    disabled={!activeNote || !isActiveDirty || isActiveSaving || isActiveDeleting}
                  >リセット</Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (!activeNote) return;
                      void handleSave(activeNote.id);
                    }}
                    disabled={!activeNote || !isActiveDirty || isActiveSaving || isActiveDeleting || !activeDraft.trim()}
                  >
                    {isActiveSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
                    保存
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="destructive" disabled={!activeNote || isActiveSaving || isActiveDeleting}>
                        {isActiveDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="mr-2 h-4 w-4" aria-hidden />}削除
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
                          onClick={() => {
                            if (!activeNote) return;
                            void handleDelete(activeNote.id);
                          }}
                        >削除する</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardFooter>
              </Card>
              <Card data-testid="notes-dialog-new">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">新しいメモ</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Textarea
                    ref={newNoteRef}
                    value={newDraft}
                    onChange={(event) => setNewDraft(event.target.value)}
                    placeholder="新しいメモを入力…"
                    rows={3}
                    onKeyDown={(event) => handleTextareaKey(event)}
                  />
                </CardContent>
                <CardFooter className="flex justify-end gap-2 pt-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setNewDraft("")}
                    disabled={!newDraft}
                  >クリア</Button>
                  <Button
                    size="sm"
                    onClick={() => { void handleCreate(); }}
                    disabled={creating || !newDraft.trim()}
                  >
                    {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Plus className="mr-2 h-4 w-4" aria-hidden />}追加
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </div>
        </div>
      )}
    </DialogContent>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      {content}
    </Dialog>
  );
}

function formatTimestamp(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
