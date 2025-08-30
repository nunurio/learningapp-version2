"use client";
import * as React from "react";
import { getCourse, listLessons, listCards } from "@/lib/localdb";
import type { UUID, Card, Lesson, Course, QuizCardContent, FillBlankCardContent } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { saveCardDraft, loadCardDraft, publishCard, type SaveCardDraftInput } from "@/lib/data";

type Props = {
  courseId: UUID;
  selectedId?: UUID;
  selectedKind?: "lesson" | "card";
};

export function Inspector({ courseId, selectedId, selectedKind }: Props) {
  const [course, setCourse] = React.useState<Course | null>(null);
  const [lesson, setLesson] = React.useState<Lesson | null>(null);
  const [card, setCard] = React.useState<Card | null>(null);
  const [form, setForm] = React.useState<SaveCardDraftInput | null>(null);
  const [saving, setSaving] = React.useState<"idle" | "saving" | "saved">("idle");
  const [savedAt, setSavedAt] = React.useState<string | null>(null);
  const debounceRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    setCourse(getCourse(courseId) ?? null);
    if (!selectedId) { setLesson(null); setCard(null); setForm(null); return; }
    if (selectedKind === "lesson") {
      const l = listLessons(courseId).find((x) => x.id === selectedId) ?? null;
      setLesson(l); setCard(null); setForm(null);
    } else if (selectedKind === "card") {
      const ls = listLessons(courseId);
      const found = ls.flatMap((l) => listCards(l.id)).find((c) => c.id === selectedId) ?? null;
      setCard(found ?? null);
      setLesson(null);
    }
  }, [courseId, selectedId, selectedKind]);

  // 下書き or 現行値でフォーム初期化
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      if (!card) { setForm(null); return; }
      const draft = await loadCardDraft(card.id);
      if (!mounted) return;
      if (draft) { setForm(draft); return; }
      if (card.cardType === "text") {
        setForm({ cardId: card.id, cardType: "text", title: card.title ?? null, tags: card.tags ?? [], body: (card.content as any).body ?? "" });
      } else if (card.cardType === "quiz") {
        const c = card.content as QuizCardContent;
        setForm({ cardId: card.id, cardType: "quiz", title: card.title ?? null, tags: card.tags ?? [], question: c.question, options: c.options, answerIndex: c.answerIndex, explanation: c.explanation ?? null });
      } else {
        const c = card.content as FillBlankCardContent;
        setForm({ cardId: card.id, cardType: "fill-blank", title: card.title ?? null, tags: card.tags ?? [], text: c.text, answers: c.answers, caseSensitive: !!c.caseSensitive });
      }
    })();
    return () => { mounted = false; };
  }, [card?.id]);

  // 500ms デバウンスのオートセーブ
  React.useEffect(() => {
    if (!form) return;
    setSaving("saving");
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      const res = await saveCardDraft(form);
      setSavedAt(res.updatedAt);
      setSaving("saved");
    }, 500);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [JSON.stringify(form)]);

  return (
    <aside className="h-full overflow-auto p-3">
      <div className="text-xs text-gray-500 mb-2">インスペクタ</div>
      {!selectedId && (
        <p className="text-sm text-gray-700">左のナビからレッスン/カードを選択すると詳細が表示されます。</p>
      )}
      {lesson && (
        <section className="space-y-1">
          <h3 className="font-medium">レッスン</h3>
          <div className="text-sm text-gray-700">{lesson.title}</div>
          <p className="text-xs text-gray-500">編集は次フェーズで追加予定です。</p>
        </section>
      )}
      {card && form && (
        <section className="space-y-2">
          <h3 className="font-medium">カード編集</h3>
          <div className="text-xs text-gray-500" aria-live="polite">
            タイプ: {form.cardType} / 保存: {saving === "saving" ? "保存中…" : saving === "saved" ? (savedAt ? `保存済み（${new Date(savedAt).toLocaleTimeString()}）` : "保存済み") : "-"}
          </div>
          <div>
            <label className="block text-sm mb-1">タイトル（任意）</label>
            <Input value={(form as any).title ?? ""} onChange={(e) => setForm((f) => f ? ({ ...f, title: e.target.value }) as any : f)} />
          </div>
          <div>
            <label className="block text-sm mb-1">タグ（カンマ区切り）</label>
            <Input
              value={(form as any).tags?.join(", ") ?? ""}
              onChange={(e) => setForm((f) => f ? ({ ...f, tags: e.target.value.split(",").map((s)=>s.trim()).filter(Boolean) }) as any : f)}
              placeholder="例: 基礎, 重要, 用語"
            />
          </div>
          {form.cardType === "text" && (
            <div>
              <label className="block text-sm mb-1">本文</label>
              <Textarea value={(form as any).body ?? ""} onChange={(e) => setForm((f) => f ? ({ ...f, body: e.target.value }) as any : f)} />
            </div>
          )}
          {form.cardType === "quiz" && (
            <div className="grid grid-cols-1 gap-2">
              <div>
                <label className="block text-sm mb-1">設問</label>
                <Input value={(form as any).question ?? ""} onChange={(e) => setForm((f) => f ? ({ ...f, question: e.target.value }) as any : f)} />
              </div>
              <div>
                <label className="block text-sm mb-1">選択肢（改行区切り）</label>
                <Textarea value={(form as any).options?.join("\n") ?? ""} onChange={(e) => setForm((f) => f ? ({ ...f, options: e.target.value.split("\n").map((s)=>s.trim()).filter(Boolean) }) as any : f)} />
              </div>
              <div>
                <label className="block text-sm mb-1">正解インデックス（0開始）</label>
                <Input type="number" value={(form as any).answerIndex ?? 0} onChange={(e) => setForm((f) => f ? ({ ...f, answerIndex: Number(e.target.value) }) as any : f)} />
              </div>
              <div>
                <label className="block text-sm mb-1">解説（任意）</label>
                <Input value={(form as any).explanation ?? ""} onChange={(e) => setForm((f) => f ? ({ ...f, explanation: e.target.value }) as any : f)} />
              </div>
            </div>
          )}
          {form.cardType === "fill-blank" && (
            <div className="grid grid-cols-1 gap-2">
              <div>
                <label className="block text-sm mb-1">テキスト（[[1]] 形式）</label>
                <Textarea value={(form as any).text ?? ""} onChange={(e) => setForm((f) => f ? ({ ...f, text: e.target.value }) as any : f)} />
              </div>
              <div>
                <label className="block text-sm mb-1">回答（k:value 改行区切り）</label>
                <Textarea value={Object.entries((form as any).answers ?? {}).map(([k,v]) => `${k}:${v}`).join("\n")} onChange={(e) => {
                  const obj: Record<string,string> = {};
                  e.target.value.split("\n").map((s)=>s.trim()).filter(Boolean).forEach((line)=>{
                    const [k,...rest] = line.split(":");
                    const v = rest.join(":").trim();
                    if (k && v) obj[k.trim()] = v;
                  });
                  setForm((f)=> f ? ({ ...f, answers: obj }) as any : f);
                }} />
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setForm((f) => f ? ({ ...f }) : f)} disabled={saving === "saving"}>下書き保存済み</Button>
            <Button onClick={async () => { if (card) { await publishCard(card.id); setSaving("idle"); } }}>公開（反映）</Button>
          </div>
        </section>
      )}
      {course && (
        <section className="mt-4">
          <h4 className="font-medium text-sm">コース</h4>
          <div className="text-sm">{course.title}</div>
        </section>
      )}
    </aside>
  );
}

function summary(c: Card): string {
  if (c.cardType === "text") return (c.content as any).body?.slice(0, 30) ?? "テキスト";
  if (c.cardType === "quiz") return (c.content as any).question ?? "クイズ";
  return (c.content as any).text?.replace(/\n/g, " ").slice(0, 30) ?? "穴埋め";
}
