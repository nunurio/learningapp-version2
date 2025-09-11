"use client";
import * as React from "react";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { Textarea } from "@/components/ui/textarea";
import MarkdownView from "@/components/markdown/MarkdownView";

export default function Page() {
  const [text, setText] = React.useState("");
  const [preview, setPreview] = React.useState(true);
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  return (
    <div className="mx-auto max-w-5xl p-4 space-y-4">
      <h1 className="text-xl font-semibold">Markdown Editor Harness</h1>
      <p className="text-sm text-gray-500">開発検証用ページ（E2E ランナー未使用）。MCPから操作します。</p>
      <EditorToolbar
        textareaRef={textareaRef}
        value={text}
        onChange={(v) => setText(v)}
        onApply={(v) => setText(v)}
        previewEnabled={preview}
        onPreviewToggle={(p) => setPreview(!!p)}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Markdown を記述…"
          data-testid="editor-textarea"
          className="min-h-[50vh] font-mono"
        />
        {preview && (
          <div data-testid="preview" className="min-h-[50vh] overflow-auto p-4 border rounded-md">
            <MarkdownView markdown={text} />
          </div>
        )}
      </div>
    </div>
  );
}

