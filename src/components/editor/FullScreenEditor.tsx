"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import MarkdownView from "@/components/markdown/MarkdownView";
import type { UUID } from "@/lib/types";
import { workspaceStore } from "@/lib/state/workspace-store";
import { saveCardDraft, publishCard, loadCardDraft, type SaveCardDraftInput } from "@/lib/data";

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
  // fill-blank
  text?: string;
  answers?: Record<string, string>;
  caseSensitive?: boolean;
};

export function FullScreenEditor(props: Props) {
  const router = useRouter();
  const [saving, setSaving] = React.useState<"idle" | "saving" | "saved">("idle");
  const [savedAt, setSavedAt] = React.useState<string | null>(null);
  const debounceRef = React.useRef<number | null>(null);

  // 統一フォーム（カード種別ごとに分岐）
  const [form, setForm] = React.useState<SaveCardDraftInput>(() => {
    if (props.cardType === "text") {
      return { cardId: props.cardId, cardType: "text", title: props.title ?? null, tags: props.tags ?? [], body: props.body ?? "" };
    }
    if (props.cardType === "quiz") {
      return {
        cardId: props.cardId,
        cardType: "quiz",
        title: props.title ?? null,
        tags: props.tags ?? [],
        question: props.question ?? "",
        options: props.options ?? [""],
        answerIndex: props.answerIndex ?? 0,
        explanation: props.explanation ?? null,
      };
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

  // 既存のローカル下書きがあれば最初に復元
  React.useEffect(() => {
    (async () => {
      const draft = await loadCardDraft(props.cardId);
      if (draft) {
        setForm(draft);
        // 復元済み本文を履歴初期値として反映できるようにマーク
        if (draft.cardType === "text") {
          pendingHistoryInitRef.current = draft.body ?? "";
        } else {
          pendingHistoryInitRef.current = null;
        }
      } else {
        pendingHistoryInitRef.current = null;
      }
    })();
  }, [props.cardId]);

  // 下書き自動保存（500ms）
  React.useEffect(() => {
    setSaving("saving");
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      const res = await saveCardDraft(form);
      setSavedAt(res.updatedAt);
      setSaving("saved");
    }, 500);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
  }, [form]);

  // workspace のドラフトと同期（ワークスペースへ戻った際の即時反映）
  React.useEffect(() => { workspaceStore.setDraft(form); }, [form]);

  const title = form.title ?? "";
  const tagsCsv = (form.tags ?? []).join(", ");
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const previewRef = React.useRef<HTMLDivElement | null>(null);
  const [preview, setPreview] = React.useState(true);

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
    if (hIndexRef.current <= 0) return;
    hIndexRef.current -= 1;
    const snap = historyRef.current[hIndexRef.current];
    setForm((f) => ({ ...f, body: snap.text }));
    requestAnimationFrame(() => { try { textareaRef.current?.setSelectionRange(snap.start, snap.end); textareaRef.current?.focus(); } catch {} });
    setCanUndo(hIndexRef.current > 0);
    setCanRedo(hIndexRef.current < historyRef.current.length - 1);
  }, []);

  const redo = React.useCallback(() => {
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
          <Button variant="outline" onClick={() => router.push(`/courses/${props.courseId}/workspace`)}>
            ワークスペースに戻る
          </Button>
          <div className="flex-1" />
          <div className="text-xs text-gray-500">
            {saving === "saving" ? "保存中…" : saving === "saved" ? (savedAt ? `保存済み（${new Date(savedAt).toLocaleTimeString()}）` : "保存済み") : "-"}
          </div>
          <Button onClick={async () => {
            // [P1] 公開直前にデバウンス中の自動保存をフラッシュして、最新フォームを保存してから公開
            if (debounceRef.current) {
              window.clearTimeout(debounceRef.current);
              debounceRef.current = null;
            }
            setSaving("saving");
            const res = await saveCardDraft(form);
            setSavedAt(res.updatedAt);
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
            onBack={() => router.push(`/courses/${props.courseId}/workspace`) }
            onPublish={async () => {
              // [P1] ツールバー経由の公開でも同様にフラッシュして保存→公開
              if (debounceRef.current) {
                window.clearTimeout(debounceRef.current);
                debounceRef.current = null;
              }
              setSaving("saving");
              const res = await saveCardDraft(form);
              setSavedAt(res.updatedAt);
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
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="タイトル（任意）"
              />
              <Input
                value={tagsCsv}
                onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value.split(",").map((s)=>s.trim()).filter(Boolean) }))}
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
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="タイトル（任意）"
            />
            <Input
              value={tagsCsv}
              onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value.split(",").map((s)=>s.trim()).filter(Boolean) }))}
              placeholder="タグ, を, カンマ区切りで"
            />
            {form.cardType === "quiz" && (
              <div className="grid grid-cols-1 gap-3">
                <Input
                  value={form.question ?? ""}
                  onChange={(e) => setForm((f) => f.cardType === "quiz" ? ({ ...f, question: e.target.value }) : f)}
                  placeholder="設問"
                />
                <Textarea
                  value={(form.options ?? []).join("\n")}
                  onChange={(e) => setForm((f) => f.cardType === "quiz" ? ({ ...f, options: e.target.value.split("\n").map((s)=>s.trim()).filter(Boolean) }) : f)}
                  placeholder={"選択肢を改行で入力"}
                />
                <Input
                  type="number"
                  value={form.answerIndex ?? 0}
                  onChange={(e) => setForm((f) => f.cardType === "quiz" ? ({ ...f, answerIndex: Number(e.target.value) }) : f)}
                  placeholder="正解インデックス（0開始）"
                />
                <Input
                  value={form.explanation ?? ""}
                  onChange={(e) => setForm((f) => f.cardType === "quiz" ? ({ ...f, explanation: e.target.value }) : f)}
                  placeholder="解説（任意）"
                />
              </div>
            )}
            {form.cardType === "fill-blank" && (
              <div className="grid grid-cols-1 gap-3">
                <Textarea
                  value={form.text ?? ""}
                  onChange={(e) => setForm((f) => f.cardType === "fill-blank" ? ({ ...f, text: e.target.value }) : f)}
                  placeholder="本文（[[1]] 形式の空所を含む）"
                />
                <Textarea
                  value={Object.entries(form.answers ?? {}).map(([k,v]) => `${k}:${v}`).join("\n")}
                  onChange={(e) => setForm((f) => {
                    if (f.cardType !== "fill-blank") return f;
                    const obj: Record<string, string> = {};
                    e.target.value.split("\n").forEach((line) => {
                      const s = line.trim(); if (!s) return;
                      const [k, ...rest] = s.split(":"); obj[k.trim()] = rest.join(":");
                    });
                    return { ...f, answers: obj };
                  })}
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
