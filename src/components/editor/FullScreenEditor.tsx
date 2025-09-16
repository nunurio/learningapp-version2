"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Check, Plus, Trash2 } from "lucide-react";
import MarkdownView from "@/components/markdown/MarkdownView";
import type { UUID } from "@/lib/types";
import { workspaceStore } from "@/lib/state/workspace-store";
import { saveCardDraft, publishCard, loadCardDraft, type SaveCardDraftInput } from "@/lib/data";

function normalizeQuizDraft(input: SaveCardDraftInput): SaveCardDraftInput {
  if (input.cardType !== "quiz") return input;
  const options = input.options ?? [];
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
  return { ...input, optionExplanations, answerIndex };
}

type Props = {
  courseId: UUID;
  cardId: UUID;
  cardType: "text" | "quiz" | "fill-blank";
  title: string | null;
  tags?: string[];
  // text
  body?: string;
  // quiz
  question?: string;
  options?: string[];
  answerIndex?: number;
  explanation?: string | null;
  optionExplanations?: (string | null)[];
  hint?: string | null;
  // fill-blank
  text?: string;
  answers?: Record<string, string>;
  caseSensitive?: boolean;
};

type QuizDraftInput = Extract<SaveCardDraftInput, { cardType: "quiz" }>;

export function FullScreenEditor(props: Props) {
  const router = useRouter();
  const [saving, setSaving] = React.useState<"idle" | "saving" | "saved">("idle");
  const [savedAt, setSavedAt] = React.useState<string | null>(null);
  const debounceRef = React.useRef<number | null>(null);
  const [navPending, startTransition] = React.useTransition();
  // 初回ドラフト読み込みが完了するまで自動保存を抑制
  const [autosaveReady, setAutosaveReady] = React.useState(false);

  // 統一フォーム（カード種別ごとに分岐）
  const [form, setForm] = React.useState<SaveCardDraftInput>(() => {
    if (props.cardType === "text") {
      return { cardId: props.cardId, cardType: "text", title: props.title ?? null, tags: props.tags ?? [], body: props.body ?? "" };
    }
    if (props.cardType === "quiz") {
      const baseOptions = props.options && props.options.length ? [...props.options] : ["", ""];
      const base: SaveCardDraftInput = {
        cardId: props.cardId,
        cardType: "quiz",
        title: props.title ?? null,
        tags: props.tags ?? [],
        question: props.question ?? "",
        options: baseOptions,
        answerIndex: props.answerIndex ?? 0,
        explanation: props.explanation ?? null,
        optionExplanations: props.optionExplanations ?? [],
        hint: props.hint ?? null,
      };
      return normalizeQuizDraft(base);
    }
    return {
      cardId: props.cardId,
      cardType: "fill-blank",
      title: props.title ?? null,
      tags: props.tags ?? [],
      text: props.text ?? "",
      answers: props.answers ?? {},
      caseSensitive: !!props.caseSensitive,
    };
  });

  // ドラフト復元後に履歴をドラフト内容で初期化するためのフラグ
  const pendingHistoryInitRef = React.useRef<string | null>(null);
  // ユーザーが編集を開始したか（ドラフト適用レース防止用）
  const userEditedRef = React.useRef(false);

  // 既存のローカル下書きがあれば最初に復元
  // ただし、読み込みが完了する前にユーザーが編集を始めていた場合は上書きしない
  React.useEffect(() => {
    userEditedRef.current = false; // カード切替時に未編集へリセット
    let cancelled = false;
    const currentId = props.cardId;
    (async () => {
      const draft = await loadCardDraft(currentId);
      if (cancelled || currentId !== props.cardId) return;
      if (draft && !userEditedRef.current) {
        setForm(normalizeQuizDraft(draft));
        // 復元済み本文を履歴初期値として反映できるようにマーク
        if (draft.cardType === "text") {
          pendingHistoryInitRef.current = draft.body ?? "";
        } else {
          pendingHistoryInitRef.current = null;
        }
      } else {
        // ドラフトなし、またはユーザー編集中の場合は履歴初期化をスキップ
        pendingHistoryInitRef.current = null;
      }
      // 既存ドラフト確認完了 → 自動保存を解放
      setAutosaveReady(true);
    })();
    return () => { cancelled = true; };
  }, [props.cardId]);

  // 下書き自動保存（500ms）— 初回ロード完了までは抑制
  React.useEffect(() => {
    if (!autosaveReady) return;
    setSaving("saving");
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      const res = await saveCardDraft(form);
      setSavedAt(res.updatedAt);
      setSaving("saved");
    }, 500);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
  }, [form, autosaveReady]);

  // workspace のドラフトと同期（ワークスペースへ戻った際の即時反映）
  React.useEffect(() => { workspaceStore.setDraft(form); }, [form]);

  const title = form.title ?? "";
  const tagsCsv = (form.tags ?? []).join(", ");
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const previewRef = React.useRef<HTMLDivElement | null>(null);
  const [preview, setPreview] = React.useState(true);
  const quizFieldIdBase = React.useId();

  const mutateQuiz = React.useCallback((mutator: (draft: QuizDraftInput) => QuizDraftInput) => {
    userEditedRef.current = true;
    setAutosaveReady(true);
    setForm((prev) => {
      if (prev.cardType !== "quiz") return prev;
      const next = mutator(prev);
      return normalizeQuizDraft(next);
    });
  }, [setAutosaveReady, setForm]);

  const handleOptionChange = React.useCallback((index: number, value: string) => {
    mutateQuiz((draft) => {
      const options = [...draft.options];
      options[index] = value;
      return { ...draft, options };
    });
  }, [mutateQuiz]);

  const handleOptionExplanationChange = React.useCallback((index: number, value: string) => {
    mutateQuiz((draft) => {
      const optionExplanations = [...(draft.optionExplanations ?? [])];
      optionExplanations[index] = value;
      return { ...draft, optionExplanations };
    });
  }, [mutateQuiz]);

  const handleAddOption = React.useCallback(() => {
    mutateQuiz((draft) => ({
      ...draft,
      options: [...draft.options, ""],
      optionExplanations: [...(draft.optionExplanations ?? []), ""],
    }));
  }, [mutateQuiz]);

  const handleRemoveOption = React.useCallback((index: number) => {
    mutateQuiz((draft) => {
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
      return {
        ...draft,
        options,
        optionExplanations,
        answerIndex,
      };
    });
  }, [mutateQuiz]);

  const handleSetCorrectOption = React.useCallback((index: number) => {
    mutateQuiz((draft) => ({ ...draft, answerIndex: index }));
  }, [mutateQuiz]);

  // 進行中のデバウンスをフラッシュして即時保存するヘルパー
  const flushDraft = React.useCallback(async () => {
    // 初期ロード未完了かつ未編集なら保存しない（既存ドラフトの上書きを防止）
    if (!autosaveReady && !userEditedRef.current) return;
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    setSaving("saving");
    const res = await saveCardDraft(form);
    setSavedAt(res.updatedAt);
    setSaving("saved");
  }, [form, autosaveReady]);

  // ナビゲーション前にフラッシュしてから遷移
  const handleBack = React.useCallback(async () => {
    await flushDraft();
    startTransition(() => router.push(`/courses/${props.courseId}/workspace`));
  }, [flushDraft, router, props.courseId]);

  // 履歴（Undo/Redo）管理
  type Snap = { text: string; start: number; end: number };
  const historyRef = React.useRef<Snap[]>([]);
  const hIndexRef = React.useRef<number>(-1);
  const [canUndo, setCanUndo] = React.useState(false);
  const [canRedo, setCanRedo] = React.useState(false);

  const pushHistory = React.useCallback((snap: Snap) => {
    // 現在位置より先の履歴を破棄
    if (hIndexRef.current < historyRef.current.length - 1) {
      historyRef.current = historyRef.current.slice(0, hIndexRef.current + 1);
    }
    const last = historyRef.current[historyRef.current.length - 1];
    if (!last || last.text !== snap.text || last.start !== snap.start || last.end !== snap.end) {
      historyRef.current.push(snap);
      hIndexRef.current = historyRef.current.length - 1;
      setCanUndo(hIndexRef.current > 0);
      setCanRedo(false);
    }
  }, []);

  // 初期化（カード切替時）
  React.useEffect(() => {
    const initial = form.cardType === "text" ? (form.body ?? "") : "";
    historyRef.current = [{ text: initial, start: 0, end: 0 }];
    hIndexRef.current = 0;
    setCanUndo(false);
    setCanRedo(false);
  }, [props.cardId]);

  // ローカル下書き復元後、Undo履歴をドラフト内容で再初期化
  React.useEffect(() => {
    if (pendingHistoryInitRef.current != null) {
      const t = pendingHistoryInitRef.current;
      historyRef.current = [{ text: t, start: 0, end: 0 }];
      hIndexRef.current = 0;
      setCanUndo(false);
      setCanRedo(false);
      pendingHistoryInitRef.current = null;
    }
  }, [form]);

  const applyText = React.useCallback((nextText: string, nextStart?: number, nextEnd?: number) => {
    userEditedRef.current = true;
    setAutosaveReady(true); // 編集開始をもって自動保存を有効化
    setForm((f) => ({ ...f, body: nextText }));
    const ta = textareaRef.current;
    const s = Math.max(0, nextStart ?? (ta?.selectionStart ?? 0));
    const e = Math.max(0, nextEnd ?? (ta?.selectionEnd ?? 0));
    pushHistory({ text: nextText, start: s, end: e });
    requestAnimationFrame(() => {
      try { textareaRef.current?.setSelectionRange(s, e); textareaRef.current?.focus(); } catch {}
    });
  }, [pushHistory]);

  const undo = React.useCallback(() => {
    userEditedRef.current = true;
    if (hIndexRef.current <= 0) return;
    hIndexRef.current -= 1;
    const snap = historyRef.current[hIndexRef.current];
    setForm((f) => ({ ...f, body: snap.text }));
    requestAnimationFrame(() => { try { textareaRef.current?.setSelectionRange(snap.start, snap.end); textareaRef.current?.focus(); } catch {} });
    setCanUndo(hIndexRef.current > 0);
    setCanRedo(hIndexRef.current < historyRef.current.length - 1);
  }, []);

  const redo = React.useCallback(() => {
    userEditedRef.current = true;
    if (hIndexRef.current >= historyRef.current.length - 1) return;
    hIndexRef.current += 1;
    const snap = historyRef.current[hIndexRef.current];
    setForm((f) => ({ ...f, body: snap.text }));
    requestAnimationFrame(() => { try { textareaRef.current?.setSelectionRange(snap.start, snap.end); textareaRef.current?.focus(); } catch {} });
    setCanUndo(hIndexRef.current > 0);
    setCanRedo(hIndexRef.current < historyRef.current.length - 1);
  }, []);

  // スクロール同期（左: textarea -> 右: preview）
  React.useEffect(() => {
    const ta = textareaRef.current;
    const pv = previewRef.current;
    if (!ta || !pv) return;
    const onScroll = () => {
      if (!ta || !pv) return;
      const ratio = ta.scrollTop / Math.max(1, ta.scrollHeight - ta.clientHeight);
      const target = ratio * Math.max(0, pv.scrollHeight - pv.clientHeight);
      pv.scrollTop = target;
    };
    // 初期表示で位置を同期しておく（プレビュー再表示時など）
    onScroll();
    ta.addEventListener("scroll", onScroll, { passive: true });
    return () => ta.removeEventListener("scroll", onScroll as EventListener);
  }, [preview]);

  return (
    <div className="h-screen w-full flex flex-col">
      {/* ヘッダー */}
      <div className="sticky top-0 z-10 border-b bg-[hsl(var(--background))]">
        <div className="mx-auto max-w-5xl px-3 py-2 flex items-center gap-2">
          <Button variant="outline" onClick={() => void handleBack()} disabled={navPending}>
            ワークスペースに戻る
          </Button>
          <div className="flex-1" />
          <div className="text-xs text-gray-500">
            {saving === "saving" ? "保存中…" : saving === "saved" ? (savedAt ? `保存済み（${new Date(savedAt).toLocaleTimeString()}）` : "保存済み") : "-"}
          </div>
          <Button onClick={async () => {
            // [P1] 公開直前にデバウンス中の自動保存をフラッシュ
            await flushDraft();
            await publishCard(props.cardId);
            workspaceStore.clearDraft(props.cardId);
            workspaceStore.bumpVersion();
          }}>
            公開
          </Button>
        </div>
      </div>

      {form.cardType === "text" ? (
        <>
          <EditorToolbar
            onBack={() => void handleBack() }
            onPublish={async () => {
              // [P1] ツールバー経由の公開でも同様にフラッシュして保存→公開
              await flushDraft();
              await publishCard(props.cardId);
              workspaceStore.clearDraft(props.cardId);
              workspaceStore.bumpVersion();
            }}
            disabled={false}
            textareaRef={textareaRef}
            value={form.body ?? ""}
            onChange={(next) => applyText(next)}
            onApply={(text, s, e) => applyText(text, s, e)}
            previewEnabled={preview}
            onPreviewToggle={(p) => setPreview(!!p)}
            onUndo={undo}
            onRedo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
          />
          <div className="flex-1 overflow-auto">
            <div className="mx-auto max-w-5xl px-3 py-4 space-y-3">
              <Input
                value={title}
                onChange={(e) => { userEditedRef.current = true; setAutosaveReady(true); setForm((f) => ({ ...f, title: e.target.value })); }}
                placeholder="タイトル（任意）"
              />
              <Input
                value={tagsCsv}
                onChange={(e) => { userEditedRef.current = true; setAutosaveReady(true); setForm((f) => ({ ...f, tags: e.target.value.split(",").map((s)=>s.trim()).filter(Boolean) })); }}
                placeholder="タグ, を, カンマ区切りで"
              />
              {preview ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border rounded-md overflow-hidden min-h-[60vh]">
                  <div className="p-0 border-r">
                    <Textarea
                      ref={textareaRef}
                      className="h-[60vh] min-h-[60vh] resize-none font-mono"
                      value={form.body ?? ""}
                      onChange={(e) => applyText(e.target.value, e.currentTarget.selectionStart ?? 0, e.currentTarget.selectionEnd ?? 0)}
                      placeholder="Markdown を記述…"
                      aria-label="Markdown を記述…"
                    />
                  </div>
                  <div ref={previewRef} className="h-[60vh] min-h-[60vh] overflow-auto p-4 bg-[hsl(var(--background))]">
                    <MarkdownView markdown={form.body ?? ""} />
                  </div>
                </div>
              ) : (
                <Textarea
                  ref={textareaRef}
                  className="min-h-[60vh] font-mono"
                  value={form.body ?? ""}
                  onChange={(e) => applyText(e.target.value, e.currentTarget.selectionStart ?? 0, e.currentTarget.selectionEnd ?? 0)}
                  placeholder="Markdown を記述…"
                  aria-label="Markdown を記述…"
                />
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 overflow-auto">
          <div className="mx-auto max-w-5xl px-3 py-4 space-y-3">
            <Input
              value={title}
              onChange={(e) => { userEditedRef.current = true; setAutosaveReady(true); setForm((f) => ({ ...f, title: e.target.value })); }}
              placeholder="タイトル（任意）"
            />
            <Input
              value={tagsCsv}
              onChange={(e) => { userEditedRef.current = true; setAutosaveReady(true); setForm((f) => ({ ...f, tags: e.target.value.split(",").map((s)=>s.trim()).filter(Boolean) })); }}
              placeholder="タグ, を, カンマ区切りで"
            />
            {form.cardType === "quiz" && (
              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="quiz-question" className="text-sm font-medium">
                    設問
                  </Label>
                  <Input
                    id="quiz-question"
                    value={form.question ?? ""}
                    onChange={(e) => mutateQuiz((draft) => ({ ...draft, question: e.target.value }))}
                    placeholder="設問"
                  />
                </div>
                <div className="space-y-3">
                  {(form.options ?? []).map((opt, idx) => {
                    const optionId = `${quizFieldIdBase}-option-${idx}`;
                    const explanationId = `${quizFieldIdBase}-explanation-${idx}`;
                    const isCorrect = form.answerIndex === idx;
                    return (
                      <Card key={optionId} className="p-4 space-y-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <Label htmlFor={optionId} className="text-sm font-medium">
                            {`選択肢 ${idx + 1}`}
                          </Label>
                          <div className="flex items-center gap-2 self-end sm:self-auto">
                            <Button
                              type="button"
                              size="sm"
                              variant={isCorrect ? "default" : "outline"}
                              onClick={() => handleSetCorrectOption(idx)}
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
                              onClick={() => handleRemoveOption(idx)}
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
                          onChange={(e) => handleOptionChange(idx, e.target.value)}
                          placeholder="選択肢を入力"
                        />
                        <div className="space-y-2">
                          <Label htmlFor={explanationId} className="text-xs font-medium text-muted-foreground">
                            {`選択肢${idx + 1}の解説`}
                          </Label>
                          <Textarea
                            id={explanationId}
                            value={form.optionExplanations?.[idx] ?? ""}
                            onChange={(e) => handleOptionExplanationChange(idx, e.target.value)}
                            placeholder="この選択肢を選んだ学習者への解説"
                          />
                        </div>
                      </Card>
                    );
                  })}
                  <Button type="button" variant="outline" onClick={handleAddOption} className="w-full sm:w-auto">
                    <Plus className="size-4" />
                    選択肢を追加
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quiz-explanation" className="text-sm font-medium">
                    全体の解説
                  </Label>
                  <Textarea
                    id="quiz-explanation"
                    value={form.explanation ?? ""}
                    onChange={(e) => mutateQuiz((draft) => ({ ...draft, explanation: e.target.value }))}
                    placeholder="全体の解説"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quiz-hint" className="text-sm font-medium">
                    ヒント
                  </Label>
                  <Textarea
                    id="quiz-hint"
                    value={form.hint ?? ""}
                    onChange={(e) => mutateQuiz((draft) => ({ ...draft, hint: e.target.value }))}
                    placeholder="ヒント（正解を直接示さず導く）"
                  />
                </div>
              </div>
            )}
            {form.cardType === "fill-blank" && (
              <div className="grid grid-cols-1 gap-3">
                <Textarea
                  value={form.text ?? ""}
                  onChange={(e) => { userEditedRef.current = true; setAutosaveReady(true); setForm((f) => f.cardType === "fill-blank" ? ({ ...f, text: e.target.value }) : f); }}
                  placeholder="本文（[[1]] 形式の空所を含む）"
                />
                <Textarea
                  value={Object.entries(form.answers ?? {}).map(([k,v]) => `${k}:${v}`).join("\n")}
                  onChange={(e) => { userEditedRef.current = true; setAutosaveReady(true); setForm((f) => {
                    if (f.cardType !== "fill-blank") return f;
                    const obj: Record<string, string> = {};
                    e.target.value.split("\n").forEach((line) => {
                      const s = line.trim(); if (!s) return;
                      const [k, ...rest] = s.split(":"); obj[k.trim()] = rest.join(":");
                    });
                    return { ...f, answers: obj };
                  }); }}
                  placeholder={"1:answer\n2:another"}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default FullScreenEditor;
