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
import { Badge } from "@/components/ui/badge";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Separator } from "@/components/ui/separator";

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
        setPendingFocus("new");
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
    <DialogContent className="sm:max-w-5xl" onOpenAutoFocus={(e) => e.preventDefault()}>
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
          <ResizablePanelGroup
            direction="horizontal"
            className="flex min-h-[380px] gap-4 rounded-3xl border border-border/50 bg-[hsl(var(--popover))]/70 p-3 shadow-[0_20px_45px_-20px_hsl(var(--background)_/_0.65)] backdrop-blur-xl"
          >
            <ResizablePanel
              defaultSize={30}
              minSize={20}
              className="overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-b from-[hsl(var(--background))] via-[hsl(var(--muted))]/30 to-[hsl(var(--background))] shadow-inner"
            >
              <div className="flex h-full flex-col">
                <div className="flex items-center justify-between px-4 pt-4">
                  <span className="text-sm font-semibold text-muted-foreground">メモ一覧</span>
                  <Badge variant="secondary" className="bg-white/60 text-xs font-medium text-muted-foreground">
                    {notes.length} 件
                  </Badge>
                </div>
                <ScrollArea className="mt-3 flex-1 pr-2" data-testid="notes-dialog-list">
                  <div className="space-y-2 pb-6">
                    {notes.length === 0 ? (
                      <div className="mx-3 rounded-xl border border-dashed border-muted-foreground/30 bg-white/40 p-6 text-center text-sm text-muted-foreground">
                        まだメモはありません。
                        <p className="mt-1 text-xs text-muted-foreground/80">右側の「新しいメモ」から追加できます。</p>
                      </div>
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
                              "group relative w-full overflow-hidden rounded-xl border px-4 py-3 text-left text-sm transition-all",
                              "bg-white/70 shadow-[0_8px_30px_-18px_rgba(15,23,42,0.45)] backdrop-blur",
                              isActive
                                ? "border-primary/60 ring-2 ring-primary/20"
                                : "border-transparent hover:border-primary/30 hover:bg-white"
                            )}
                          >
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span className="font-medium text-foreground/80">{formatTimestamp(note.createdAt)}</span>
                              {isDirty ? (
                                <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                                  未保存
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground/70">更新: {formatTimestamp(note.updatedAt)}</span>
                              )}
                            </div>
                            <Separator className="my-3 bg-muted-foreground/10" />
                            <p className="line-clamp-3 text-sm text-foreground/90">
                              {note.text.trim() ? note.text : "（空のメモ）"}
                            </p>
                          </button>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle className="hidden md:flex" />
            <ResizablePanel defaultSize={70} minSize={45} className="flex flex-col gap-4">
              <Card
                data-testid="notes-dialog-detail"
                className="flex-1 overflow-hidden border border-border/40 bg-gradient-to-br from-white via-[hsl(var(--accent))]/10 to-white shadow-[0_25px_50px_-25px_rgba(59,130,246,0.35)]"
              >
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="text-base">メモ詳細</CardTitle>
                  {activeNote ? (
                    <Badge variant="secondary" className="bg-white/80 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {formatTimestamp(activeNote.updatedAt)} 更新
                    </Badge>
                  ) : null}
                </CardHeader>
                <CardContent className="flex flex-1 flex-col space-y-4">
                  {activeNote ? (
                    <>
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        <Badge variant="secondary" className="bg-muted text-muted-foreground">
                          作成: {formatTimestamp(activeNote.createdAt)}
                        </Badge>
                        <Badge variant="secondary" className="bg-muted text-muted-foreground">
                          カードID: {activeNote.cardId}
                        </Badge>
                      </div>
                      <Textarea
                        ref={activeTextareaRef}
                        value={activeDraft}
                        onChange={(event) => {
                          const value = event.target.value;
                          setNoteDrafts((state) => ({ ...state, [activeNote.id]: value }));
                        }}
                        placeholder="メモ…"
                        rows={7}
                        className="min-h-[200px] resize-none rounded-xl border border-muted-foreground/20 bg-white/80 shadow-inner focus-visible:border-primary/50"
                        onKeyDown={(event) => handleTextareaKey(event, activeNote.id)}
                      />
                    </>
                  ) : (
                    <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-muted-foreground/30 bg-white/60 p-10 text-sm text-muted-foreground">
                      編集するメモを左の一覧から選択してください。
                    </div>
                  )}
                </CardContent>
                <CardFooter className="flex flex-wrap justify-end gap-2 pt-0">
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
              <Card
                data-testid="notes-dialog-new"
                className="border border-dashed border-primary/40 bg-gradient-to-r from-primary/10 via-white to-primary/5 shadow-[0_18px_30px_-18px_rgba(59,130,246,0.45)]"
              >
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Badge variant="secondary" className="bg-primary/15 text-primary">新規</Badge>
                    新しいメモ
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Textarea
                    ref={newNoteRef}
                    value={newDraft}
                    onChange={(event) => setNewDraft(event.target.value)}
                    placeholder="新しいメモを入力…"
                    rows={4}
                    className="resize-none rounded-xl border border-primary/30 bg-white/80 shadow-inner focus-visible:border-primary"
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
                    onClick={() => {
                      void handleCreate();
                    }}
                    disabled={creating || !newDraft.trim()}
                  >
                    {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Plus className="mr-2 h-4 w-4" aria-hidden />}追加
                  </Button>
                </CardFooter>
              </Card>
            </ResizablePanel>
          </ResizablePanelGroup>
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
