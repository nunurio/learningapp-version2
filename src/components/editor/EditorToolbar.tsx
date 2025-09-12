"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
  MenubarSub,
  MenubarSubTrigger,
  MenubarSubContent,
} from "@/components/ui/menubar";
// Toggle は使わず Button に統一
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
// Reserved: link popover, etc.
// import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
// import { Input } from "@/components/ui/input";
import {
  Bold,
  Italic,
  Code,
  Strikethrough,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Minus,
  Undo,
  Redo,
  Eye,
} from "lucide-react";

type Props = {
  onPublish?: () => Promise<void> | void;
  onBack?: () => void;
  disabled?: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (next: string) => void;
  onApply?: (nextText: string, nextStart: number, nextEnd: number) => void;
  previewEnabled?: boolean;
  onPreviewToggle?: (next: boolean) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
};

function getSelection(textarea: HTMLTextAreaElement) {
  const start = textarea.selectionStart ?? 0;
  const end = textarea.selectionEnd ?? 0;
  return { start, end };
}

function replaceRange(src: string, start: number, end: number, insert: string) {
  return src.slice(0, start) + insert + src.slice(end);
}

function wrapOrUnwrap(
  src: string,
  selStart: number,
  selEnd: number,
  markLeft: string,
  markRight = markLeft
) {
  const selected = src.slice(selStart, selEnd);
  const has = selected.startsWith(markLeft) && selected.endsWith(markRight);
  if (has) {
    const unwrapped = selected.slice(markLeft.length, selected.length - markRight.length);
    const text = replaceRange(src, selStart, selEnd, unwrapped);
    const nextStart = selStart;
    const nextEnd = selStart + unwrapped.length;
    return { text, nextStart, nextEnd };
  }
  const wrapped = markLeft + selected + markRight;
  const text = replaceRange(src, selStart, selEnd, wrapped);
  const nextStart = selStart + markLeft.length;
  const nextEnd = nextStart + selected.length;
  return { text, nextStart, nextEnd };
}

function toggleLinesPrefix(src: string, selStart: number, selEnd: number, prefix: string) {
  // 対象範囲の行頭オフセットを計算
  const before = src.slice(0, selStart);
  const startLineIdx = before.lastIndexOf("\n") + 1;
  const after = src.slice(selEnd);
  const endLineIdx = selEnd + after.indexOf("\n");
  const effectiveEnd = endLineIdx === selEnd - 1 ? selEnd : (endLineIdx >= selEnd ? endLineIdx : src.length);
  const block = src.slice(startLineIdx, effectiveEnd);
  const lines = block.split(/\n/);
  const allPrefixed = lines.every((l) => l.startsWith(prefix));
  const nextLines = lines.map((l) => (allPrefixed ? l.replace(new RegExp("^" + prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "") : prefix + l));
  const replaced = nextLines.join("\n");
  const text = src.slice(0, startLineIdx) + replaced + src.slice(effectiveEnd);
  // ざっくり選択継続（先頭行へ）
  const nextStart = startLineIdx;
  const nextEnd = startLineIdx + replaced.length;
  return { text, nextStart, nextEnd };
}

function insertHr(src: string, selStart: number, selEnd: number) {
  const hr = "\n\n---\n\n";
  const text = replaceRange(src, selStart, selEnd, hr);
  const pos = selStart + hr.length;
  return { text, nextStart: pos, nextEnd: pos };
}

function toggleHeading(src: string, selStart: number, selEnd: number, level: number) {
  const hashes = "#".repeat(Math.min(6, Math.max(1, level))) + " ";
  // 行範囲を取得（toggleLinesPrefix と同等の境界計算）
  const before = src.slice(0, selStart);
  const startLineIdx = before.lastIndexOf("\n") + 1;
  const after = src.slice(selEnd);
  const endLineIdx = selEnd + after.indexOf("\n");
  const effectiveEnd = endLineIdx === selEnd - 1 ? selEnd : (endLineIdx >= selEnd ? endLineIdx : src.length);
  const block = src.slice(startLineIdx, effectiveEnd);
  const lines = block.split(/\n/);
  const allRequested = lines.every((l) => l.startsWith(hashes));
  const nextLines = allRequested
    // すでに同一レベル -> 見出しを除去
    ? lines.map((l) => l.replace(/^#{1,6}\s+/, ""))
    // 異なるレベル -> 既存の見出しを除去して目的レベルを付与
    : lines.map((l) => hashes + l.replace(/^#{1,6}\s+/, ""));
  const replaced = nextLines.join("\n");
  const text = src.slice(0, startLineIdx) + replaced + src.slice(effectiveEnd);
  const nextStart = startLineIdx;
  const nextEnd = startLineIdx + replaced.length;
  return { text, nextStart, nextEnd };
}

export function EditorToolbar({ onPublish, onBack, disabled, textareaRef, value, onChange, onApply, previewEnabled = false, onPreviewToggle, onUndo, onRedo, canUndo, canRedo }: Props) {
  const uiDisabled = !!disabled;
  const [fmt, setFmt] = React.useState({ bold: false, italic: false, code: false, strike: false, quote: false, ul: false, ol: false, h1: false, h2: false });
  // 直前の選択範囲スナップショット（ボタンクリック時の選択ロスト対策）
  const lastSelRef = React.useRef<{ start: number; end: number } | null>(null);

  const snapshotSelection = React.useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const { start, end } = getSelection(ta);
    lastSelRef.current = { start, end };
  }, [textareaRef]);

  const computeFormat = React.useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    // フォーカスが textarea から外れている / 選択が消えている場合は直前スナップショットを使用
    const cur = getSelection(ta);
    const active = typeof document !== "undefined" ? (document.activeElement as Element | null) : null;
    const useSnap = (active && active !== ta) || (cur.start === cur.end && lastSelRef.current && lastSelRef.current.start !== lastSelRef.current.end);
    const { start, end } = useSnap && lastSelRef.current ? lastSelRef.current : cur;
    const s = value;
    const before = s.slice(0, start);
    const lineStart = before.lastIndexOf("\n") + 1;
    const line = s.slice(lineStart, s.indexOf("\n", start) === -1 ? s.length : s.indexOf("\n", start));
    const hasWrap = (left: string, right = left) => {
      const b = s.slice(Math.max(0, start - left.length), start);
      const a = s.slice(end, end + right.length);
      if (b === left && a === right) return true;
      const selected = s.slice(start, end);
      return selected.startsWith(left) && selected.endsWith(right);
    };
    setFmt({
      bold: hasWrap("**"),
      // 太字(**)のみを斜体(*)と誤判定しないよう相互排他にする
      italic: hasWrap("*") && !hasWrap("**"),
      code: hasWrap("`"),
      strike: hasWrap("~~"),
      quote: /^>\s/.test(line),
      ul: /^-\s/.test(line),
      ol: /^\d+\.\s/.test(line),
      h1: /^#\s(?!#)/.test(line),
      h2: /^##\s/.test(line),
    });
  }, [textareaRef, value]);

  React.useEffect(() => { computeFormat(); }, [computeFormat]);
  React.useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const handler: EventListener = () => { snapshotSelection(); computeFormat(); };
    ta.addEventListener("keyup", handler);
    ta.addEventListener("mouseup", handler);
    ta.addEventListener("input", handler);
    ta.addEventListener("select", handler);
    return () => {
      ta.removeEventListener("keyup", handler);
      ta.removeEventListener("mouseup", handler);
      ta.removeEventListener("input", handler);
      ta.removeEventListener("select", handler);
    };
  }, [textareaRef, computeFormat, snapshotSelection]);

  const withSelection = React.useCallback(
    (fn: (v: string, start: number, end: number) => { text: string; nextStart: number; nextEnd: number }) => {
      const ta = textareaRef.current;
      if (!ta) return;
      // 先に現在の選択/スナップショットを解決
      const cur = getSelection(ta);
      const active = typeof document !== "undefined" ? (document.activeElement as Element | null) : null;
      const useSnap = (active && active !== ta) || (cur.start === cur.end && lastSelRef.current && lastSelRef.current.start !== lastSelRef.current.end);
      const { start, end } = useSnap && lastSelRef.current ? lastSelRef.current : cur;
      const { text, nextStart, nextEnd } = fn(value, start, end);
      // onApplyがあれば履歴管理含めて親で処理
      if (onApply) {
        onApply(text, nextStart, nextEnd);
      } else {
        onChange(text);
        requestAnimationFrame(() => {
          try {
            ta.setSelectionRange(nextStart, nextEnd);
            ta.focus();
          } catch {}
        });
      }
    },
    [textareaRef, value, onChange, onApply]
  );

  const applyBold = () => withSelection((v, s, e2) => wrapOrUnwrap(v, s, e2, "**"));
  const applyItalic = () => withSelection((v, s, e2) => wrapOrUnwrap(v, s, e2, "*"));
  const applyCode = () => withSelection((v, s, e2) => wrapOrUnwrap(v, s, e2, "`"));
  const applyStrike = () => withSelection((v, s, e2) => wrapOrUnwrap(v, s, e2, "~~"));
  const applyHeading = (lvl: number) => withSelection((v, s, e2) => toggleHeading(v, s, e2, lvl));
  const applyQuote = () => withSelection((v, s, e2) => toggleLinesPrefix(v, s, e2, "> "));
  const applyUl = () => withSelection((v, s, e2) => toggleLinesPrefix(v, s, e2, "- "));
  const applyOl = () => withSelection((v, s, e2) => toggleLinesPrefix(v, s, e2, "1. "));
  const applyHr = () => withSelection((v, s, e2) => insertHr(v, s, e2));

  const onBold = (e: React.MouseEvent) => { e.preventDefault(); applyBold(); };
  const onItalic = (e: React.MouseEvent) => { e.preventDefault(); applyItalic(); };
  const onCode = (e: React.MouseEvent) => { e.preventDefault(); applyCode(); };
  const onStrike = (e: React.MouseEvent) => { e.preventDefault(); applyStrike(); };
  const onH = (lvl: number) => (e: React.MouseEvent) => { e.preventDefault(); applyHeading(lvl); };
  const onQuote = (e: React.MouseEvent) => { e.preventDefault(); applyQuote(); };
  const onUl = (e: React.MouseEvent) => { e.preventDefault(); applyUl(); };
  const onOl = (e: React.MouseEvent) => { e.preventDefault(); applyOl(); };
  const onHr = (e: React.MouseEvent) => { e.preventDefault(); applyHr(); };
  const onUndoClick = (e: React.MouseEvent) => { e.preventDefault(); onUndo?.(); };
  const onRedoClick = (e: React.MouseEvent) => { e.preventDefault(); onRedo?.(); };

  return (
    <div
      className="sticky top-14 z-40 w-full border-b bg-[hsl(var(--background))] pointer-events-auto"
      // どのボタンを押す場合でも最初に選択範囲をスナップショット
      onPointerDownCapture={() => snapshotSelection()}
    >
      <div className="mx-auto max-w-5xl px-3 py-2 space-y-2">
        <TooltipProvider delayDuration={120} skipDelayDuration={0}>
        {/* Menubar */}
        <Menubar>
          <MenubarMenu>
            <MenubarTrigger>File</MenubarTrigger>
            <MenubarContent>
              {onBack && <MenubarItem onClick={onBack} disabled={uiDisabled}>Back to Workspace</MenubarItem>}
              <MenubarSeparator />
              {onPublish && <MenubarItem onClick={() => void onPublish()} disabled={uiDisabled}>Publish</MenubarItem>}
            </MenubarContent>
          </MenubarMenu>
          <MenubarMenu>
            <MenubarTrigger>Edit</MenubarTrigger>
            <MenubarContent>
              <MenubarItem onMouseDown={onUndo} disabled={uiDisabled}>Undo</MenubarItem>
              <MenubarItem onMouseDown={onRedo} disabled={uiDisabled}>Redo</MenubarItem>
            </MenubarContent>
          </MenubarMenu>
          <MenubarMenu>
            <MenubarTrigger>Insert</MenubarTrigger>
            <MenubarContent>
              <MenubarSub>
                <MenubarSubTrigger>Heading</MenubarSubTrigger>
                <MenubarSubContent>
                  <MenubarItem onMouseDown={onH(1)} disabled={uiDisabled}>H1</MenubarItem>
                  <MenubarItem onMouseDown={onH(2)} disabled={uiDisabled}>H2</MenubarItem>
                  <MenubarItem onMouseDown={onH(3)} disabled={uiDisabled}>H3</MenubarItem>
                  <MenubarItem onMouseDown={onH(4)} disabled={uiDisabled}>H4</MenubarItem>
                </MenubarSubContent>
              </MenubarSub>
              <MenubarItem onMouseDown={onQuote} disabled={uiDisabled}>Blockquote</MenubarItem>
              <MenubarItem onMouseDown={onHr} disabled={uiDisabled}>Horizontal Rule</MenubarItem>
              <MenubarItem onMouseDown={onUl} disabled={uiDisabled}>Bullet List</MenubarItem>
              <MenubarItem onMouseDown={onOl} disabled={uiDisabled}>Ordered List</MenubarItem>
            </MenubarContent>
          </MenubarMenu>
          <MenubarMenu>
            <MenubarTrigger>Format</MenubarTrigger>
            <MenubarContent>
              <MenubarItem onMouseDown={onBold} disabled={uiDisabled}>Bold</MenubarItem>
              <MenubarItem onMouseDown={onItalic} disabled={uiDisabled}>Italic</MenubarItem>
              <MenubarItem onMouseDown={onCode} disabled={uiDisabled}>Inline Code</MenubarItem>
              <MenubarItem onMouseDown={onStrike} disabled={uiDisabled}>Strikethrough</MenubarItem>
            </MenubarContent>
          </MenubarMenu>
        </Menubar>

        {/* Quick toolbar (全て Button に統一) */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant={fmt.bold ? "secondary" : "outline"}
                  className="hover:bg-accent/20"
                  onMouseDown={onBold}
                  aria-pressed={fmt.bold}
                  aria-label="Bold (⌘B)"
                  disabled={uiDisabled}
                >
                  <Bold className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>太字 (⌘B)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant={fmt.italic ? "secondary" : "outline"}
                  className="hover:bg-accent/20"
                  onMouseDown={onItalic}
                  aria-pressed={fmt.italic}
                  aria-label="Italic (⌘I)"
                  disabled={uiDisabled}
                >
                  <Italic className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>斜体 (⌘I)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant={fmt.code ? "secondary" : "outline"}
                  className="hover:bg-accent/20"
                  onMouseDown={onCode}
                  aria-pressed={fmt.code}
                  aria-label="Inline Code"
                  disabled={uiDisabled}
                >
                  <Code className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>インラインコード</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant={fmt.strike ? "secondary" : "outline"}
                  className="hover:bg-accent/20"
                  onMouseDown={onStrike}
                  aria-pressed={fmt.strike}
                  aria-label="Strikethrough"
                  disabled={uiDisabled}
                >
                  <Strikethrough className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>取り消し線</TooltipContent>
            </Tooltip>
          </div>
          <Separator orientation="vertical" className="h-6" />
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant={fmt.h1 ? "secondary" : "outline"}
                  className="hover:bg-accent/20"
                  onMouseDown={onH(1)}
                  aria-pressed={fmt.h1}
                  aria-label="Heading 1"
                  disabled={uiDisabled}
                >
                  <Heading1 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>見出し1</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant={fmt.h2 ? "secondary" : "outline"}
                  className="hover:bg-accent/20"
                  onMouseDown={onH(2)}
                  aria-pressed={fmt.h2}
                  aria-label="Heading 2"
                  disabled={uiDisabled}
                >
                  <Heading2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>見出し2</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant={fmt.quote ? "secondary" : "outline"}
                  className="hover:bg-accent/20"
                  onMouseDown={onQuote}
                  aria-pressed={fmt.quote}
                  aria-label="Blockquote"
                  disabled={uiDisabled}
                >
                  <Quote className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>引用</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant={fmt.ul ? "secondary" : "outline"}
                  className="hover:bg-accent/20"
                  onMouseDown={onUl}
                  aria-pressed={fmt.ul}
                  aria-label="Bullet list"
                  disabled={uiDisabled}
                >
                  <List className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>箇条書き</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant={fmt.ol ? "secondary" : "outline"}
                  className="hover:bg-accent/20"
                  onMouseDown={onOl}
                  aria-pressed={fmt.ol}
                  aria-label="Ordered list"
                  disabled={uiDisabled}
                >
                  <ListOrdered className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>番号リスト</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="outline" className="hover:bg-accent/20" onMouseDown={onHr} disabled={uiDisabled}>
                  <Minus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>水平線</TooltipContent>
            </Tooltip>
          </div>
          {/* Link 挿入ボタンは後続対応予定 */}
          <div className="flex-1" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant={previewEnabled ? "secondary" : "outline"}
                className="hover:bg-accent/20"
                onMouseDown={(e) => { e.preventDefault(); onPreviewToggle?.(!previewEnabled); }}
                aria-pressed={!!previewEnabled}
                aria-label="Preview"
                disabled={uiDisabled}
                title="プレビュー切替"
              >
                <Eye className="h-4 w-4 mr-1" /> Preview
              </Button>
            </TooltipTrigger>
            <TooltipContent>プレビュー切替</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="outline" className="hover:bg-accent/20" onMouseDown={onUndoClick} disabled={uiDisabled}>
                <Undo className="h-4 w-4 mr-1" /> Undo
              </Button>
            </TooltipTrigger>
            <TooltipContent>元に戻す</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="outline" className="hover:bg-accent/20" onMouseDown={onRedoClick} disabled={uiDisabled}>
                <Redo className="h-4 w-4 mr-1" /> Redo
              </Button>
            </TooltipTrigger>
            <TooltipContent>やり直し</TooltipContent>
          </Tooltip>
        </div>
        </TooltipProvider>
      </div>
    </div>
  );
}

export default EditorToolbar;
