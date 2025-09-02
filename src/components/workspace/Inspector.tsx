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
} from "@/lib/client-api";
import type { UUID, Card, Lesson, Course, QuizCardContent, FillBlankCardContent, LessonCards, CardType, TextCardContent } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SSETimeline } from "@/components/ui/SSETimeline";
import { LessonCardsRunner } from "@/components/ai/LessonCardsRunner";
import { Confirm } from "@/components/ui/confirm";
import { Select } from "@/components/ui/select";
import { SortableList } from "@/components/dnd/SortableList";
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
  const [lessons, setLessons] = React.useState<Lesson[]>([]);
  const [cards, setCards] = React.useState<Card[]>([]);
  // Reserved UI states (unused currently)

  // AI lesson-cards generation state
  const [runningLesson, setRunningLesson] = React.useState<Lesson | null>(null);
  const [logsByLesson, setLogsByLesson] = React.useState<Record<string, { ts: number; text: string }[]>>({});
  const [previews, setPreviews] = React.useState<Record<string, { draftId: string; payload: LessonCards }>>({});
  const [selectedIndexes, setSelectedIndexes] = React.useState<Record<string, Record<number, boolean>>>({});

  async function refreshLists() {
    const snap = await fetchSnapshot();
    const co = snap.courses.find((c) => c.id === courseId) ?? null;
    setCourse(co);
    const ls = snap.lessons.filter((l) => l.courseId === courseId).sort((a, b) => a.orderIndex - b.orderIndex || a.createdAt.localeCompare(b.createdAt));
    setLessons(ls);
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
  }

  React.useEffect(() => { void refreshLists(); }, [courseId, selectedId, selectedKind]);

  // 下書き or 現行値でフォーム初期化
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      if (!card) { setForm(null); return; }
      const draft = await loadCardDraft(card.id);
      if (!mounted) return;
      if (draft) { setForm(draft); return; }
      if (card.cardType === "text") {
        const c = card.content as TextCardContent;
        setForm({ cardId: card.id, cardType: "text", title: card.title ?? null, tags: card.tags ?? [], body: c.body ?? "" });
      } else if (card.cardType === "quiz") {
        const c = card.content as QuizCardContent;
        setForm({ cardId: card.id, cardType: "quiz", title: card.title ?? null, tags: card.tags ?? [], question: c.question, options: c.options, answerIndex: c.answerIndex, explanation: c.explanation ?? null });
      } else {
        const c = card.content as FillBlankCardContent;
        setForm({ cardId: card.id, cardType: "fill-blank", title: card.title ?? null, tags: card.tags ?? [], text: c.text, answers: c.answers, caseSensitive: !!c.caseSensitive });
      }
    })();
    return () => { mounted = false; };
  }, [card]);

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
  }, [form]);

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

  // レッスン上部ツールはファイルスコープの安定コンポーネントに移動（下方で定義）

  return (
    <aside className="h-full overflow-auto p-3">
      <div className="text-xs text-gray-500 mb-2">インスペクタ</div>
      {currentLesson && (
        <LessonTools
          lesson={currentLesson}
          runningLesson={runningLesson}
          setRunningLesson={setRunningLesson}
          logsByLesson={logsByLesson}
          setLogsByLesson={setLogsByLesson}
          previews={previews}
          setPreviews={setPreviews}
          selectedIndexes={selectedIndexes}
          setSelectedIndexes={setSelectedIndexes}
          onSaveAll={async (lessonId, payload, selected) => {
            const idxs = Object.entries(selected).filter(([, v]) => v).map(([k]) => Number(k));
            const res = idxs.length > 0
              ? await commitLessonCardsPartialApi({ draftId: payload.draftId, lessonId, selectedIndexes: idxs })
              : await commitLessonCardsApi({ draftId: payload.draftId, lessonId });
            if (!res) return alert("保存に失敗しました");
            refreshLists();
            setPreviews((prev) => { const copy = { ...prev }; delete copy[lessonId]; return copy; });
          }}
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
      {selectedKind === "card" && card && form && (
        <section className="space-y-2">
          <h3 className="font-medium">カード編集</h3>
          <div className="text-xs text-gray-500" aria-live="polite">
            タイプ: {form.cardType} / 保存: {saving === "saving" ? "保存中…" : saving === "saved" ? (savedAt ? `保存済み（${new Date(savedAt).toLocaleTimeString()}）` : "保存済み") : "-"}
          </div>
          <div>
            <label className="block text-sm mb-1">タイトル（任意）</label>
            <Input value={form.title ?? ""} onChange={(e) => setForm((f) => (f ? { ...f, title: e.target.value } : f))} />
          </div>
          <div>
            <label className="block text-sm mb-1">タグ（カンマ区切り）</label>
            <Input
              value={(form.tags ?? []).join(", ")}
              onChange={(e) => setForm((f) => (f ? { ...f, tags: e.target.value.split(",").map((s)=>s.trim()).filter(Boolean) } : f))}
              placeholder="例: 基礎, 重要, 用語"
            />
          </div>
          {form.cardType === "text" && (
            <div>
              <label className="block text-sm mb-1">本文</label>
              <Textarea value={form.cardType === "text" ? form.body : ""} onChange={(e) => setForm((f) => (f && f.cardType === "text" ? { ...f, body: e.target.value } : f))} />
            </div>
          )}
          {form.cardType === "quiz" && (
            <div className="grid grid-cols-1 gap-2">
              <div>
                <label className="block text-sm mb-1">設問</label>
                <Input value={form.cardType === "quiz" ? form.question : ""} onChange={(e) => setForm((f) => (f && f.cardType === "quiz" ? { ...f, question: e.target.value } : f))} />
              </div>
              <div>
                <label className="block text-sm mb-1">選択肢（改行区切り）</label>
                <Textarea value={form.cardType === "quiz" ? (form.options ?? []).join("\n") : ""} onChange={(e) => setForm((f) => (f && f.cardType === "quiz" ? { ...f, options: e.target.value.split("\n").map((s)=>s.trim()).filter(Boolean) } : f))} />
              </div>
              <div>
                <label className="block text-sm mb-1">正解インデックス（0開始）</label>
                <Input type="number" value={form.cardType === "quiz" ? (form.answerIndex ?? 0) : 0} onChange={(e) => setForm((f) => (f && f.cardType === "quiz" ? { ...f, answerIndex: Number(e.target.value) } : f))} />
              </div>
              <div>
                <label className="block text-sm mb-1">解説（任意）</label>
                <Input value={form.cardType === "quiz" ? (form.explanation ?? "") : ""} onChange={(e) => setForm((f) => (f && f.cardType === "quiz" ? { ...f, explanation: e.target.value } : f))} />
              </div>
            </div>
          )}
          {form.cardType === "fill-blank" && (
            <div className="grid grid-cols-1 gap-2">
              <div>
                <label className="block text-sm mb-1">テキスト（[[1]] 形式）</label>
                <Textarea value={form.cardType === "fill-blank" ? form.text : ""} onChange={(e) => setForm((f) => (f && f.cardType === "fill-blank" ? { ...f, text: e.target.value } : f))} />
              </div>
              <div>
                <label className="block text-sm mb-1">回答（k:value 改行区切り）</label>
                <Textarea value={Object.entries(form.cardType === "fill-blank" ? (form.answers ?? {}) : {}).map(([k,v]) => `${k}:${v}`).join("\n")} onChange={(e) => {
                  const obj: Record<string,string> = {};
                  e.target.value.split("\n").map((s)=>s.trim()).filter(Boolean).forEach((line)=>{
                    const [k,...rest] = line.split(":");
                    const v = rest.join(":").trim();
                    if (k && v) obj[k.trim()] = v;
                  });
                  setForm((f)=> (f && f.cardType === "fill-blank" ? { ...f, answers: obj } : f));
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
};

function LessonTools({ lesson, runningLesson, setRunningLesson, logsByLesson, setLogsByLesson, previews, setPreviews, selectedIndexes, setSelectedIndexes, onSaveAll }: LessonToolsProps) {
  return (
    <section className="mb-3 rounded-md border border-[hsl(var(--border))] p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium">レッスンツール</div>
        <div className="text-xs text-gray-600 truncate max-w-[60%]" title={lesson.title}>{lesson.title}</div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-gray-700">AIでこのレッスンのカードを生成</div>
        <Button size="sm" onClick={() => setRunningLesson(lesson)} disabled={!!runningLesson && runningLesson.id === lesson.id}>
          {runningLesson?.id === lesson.id ? "生成中…" : "AIで生成"}
        </Button>
      </div>
      {runningLesson?.id === lesson.id && (
        <LessonCardsRunner
          lessonId={lesson.id}
          lessonTitle={lesson.title}
          onLog={(id, text) => setLogsByLesson((m) => ({ ...m, [id]: [...(m[id] ?? []), { ts: Date.now(), text }] }))}
          onPreview={(id, draftId, payload) => setPreviews((prev) => ({ ...prev, [id]: { draftId, payload } }))}
          onFinish={() => setRunningLesson(null)}
        />
      )}
      <SSETimeline logs={logsByLesson[lesson.id] ?? []} />
      {previews[lesson.id] && (
        <div className="mt-3">
          <div className="text-sm text-gray-600 mb-2">プレビュー: {previews[lesson.id].payload.cards.length} 件（反映するカードを選択、未選択なら全件）</div>
          <ol className="text-sm space-y-1 list-decimal list-inside">
            {previews[lesson.id].payload.cards.map((c, idx) => (
              <li key={idx} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  aria-label={`カード #${idx + 1} を選択`}
                  checked={!!(selectedIndexes[lesson.id]?.[idx])}
                  onChange={(e) => setSelectedIndexes((m) => ({ ...m, [lesson.id]: { ...(m[lesson.id] || {}), [idx]: e.target.checked } }))}
                />
                <span className="px-1 py-0.5 rounded bg-black/5 mr-2">{c.type}</span>
                {"title" in c && c.title ? c.title : c.type === "text" ? "テキスト" : "カード"}
              </li>
            ))}
          </ol>
          <div className="mt-3 flex justify-end gap-2">
            <Button onClick={() => onSaveAll(lesson.id, previews[lesson.id], selectedIndexes[lesson.id] || {})}>保存</Button>
            <Button onClick={() => setPreviews((prev) => { const copy = { ...prev }; delete copy[lesson.id]; return copy; })}>破棄</Button>
          </div>
        </div>
      )}
    </section>
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
        <Button onClick={async () => { if (!title.trim()) return; await addLessonApi(course.id, title); setTitle(""); onRefresh(); }}>レッスン追加</Button>
      </div>
      <div>
        <h4 className="text-sm text-gray-700 mb-2">レッスン並び替え</h4>
        <SortableList
          ids={lessons.map((l) => l.id)}
          label="レッスンの並び替え"
          onReorder={async (ids) => { await reorderLessonsApi(course.id, ids); onRefresh(); }}
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
                  onConfirm={async () => { await deleteLessonApi(l.id); onRefresh(); }}
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
  cards: Card[];
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
      <div className="rounded-md border border-[hsl(var(--border))] p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm text-gray-700">AIでこのレッスンのカードを生成</div>
          <Button size="sm" onClick={() => setRunningLesson(lesson)} disabled={!!runningLesson && runningLesson.id === lesson.id}>
            {runningLesson?.id === lesson.id ? "生成中…" : "AIで生成"}
          </Button>
        </div>
        {runningLesson?.id === lesson.id && (
          <LessonCardsRunner
            lessonId={lesson.id}
            lessonTitle={lesson.title}
            onLog={(id, text) => setLogsByLesson((m) => ({ ...m, [id]: [...(m[id] ?? []), { ts: Date.now(), text }] }))}
            onPreview={(id, draftId, payload) => setPreviews((prev) => ({ ...prev, [id]: { draftId, payload } }))}
            onFinish={() => setRunningLesson(null)}
          />
        )}
        <SSETimeline logs={logsByLesson[lesson.id] ?? []} />
        {previews[lesson.id] && (
          <div className="mt-3">
            <div className="text-sm text-gray-600 mb-2">プレビュー: {previews[lesson.id].payload.cards.length} 件（反映するカードを選択、未選択なら全件）</div>
            <ol className="text-sm space-y-1 list-decimal list-inside">
              {previews[lesson.id].payload.cards.map((c, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    aria-label={`カード #${idx + 1} を選択`}
                    checked={!!(selectedIndexes[lesson.id]?.[idx])}
                    onChange={(e) => setSelectedIndexes((m) => ({ ...m, [lesson.id]: { ...(m[lesson.id] || {}), [idx]: e.target.checked } }))}
                  />
                  <span className="px-1 py-0.5 rounded bg-black/5 mr-2">{c.type}</span>
                  {"title" in c && c.title ? c.title : c.type === "text" ? "テキスト" : "カード"}
                </li>
              ))}
            </ol>
            <div className="mt-3 flex justify-end gap-2">
              <Button
                onClick={async () => {
                  const p = previews[lesson.id];
                  if (!p) return;
                  const selected = selectedIndexes[lesson.id] || {};
                  const idxs = Object.entries(selected).filter(([, v]) => v).map(([k]) => Number(k));
                  const res = idxs.length > 0
                    ? await commitLessonCardsPartialApi({ draftId: p.draftId, lessonId: lesson.id, selectedIndexes: idxs })
                    : await commitLessonCardsApi({ draftId: p.draftId, lessonId: lesson.id });
                  if (res) { onRefresh(); }
                  setPreviews((prev) => { const copy = { ...prev }; delete copy[lesson.id]; return copy; });
                }}
              >保存</Button>
              <Button onClick={() => setPreviews((prev) => { const copy = { ...prev }; delete copy[lesson.id]; return copy; })}>破棄</Button>
            </div>
          </div>
        )}
      </div>
      )}

      {/* 手動でカード追加 */}
      <div className="rounded-md border border-[hsl(var(--border))] p-3">
        <div className="text-sm font-medium mb-2">新規カード</div>
        <NewCardForm lessonId={lesson.id} onDone={onRefresh} />
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
            onReorder={async (ids) => { await reorderCardsApi(lesson.id, ids); onRefresh(); }}
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
                    onConfirm={async () => { await deleteCardApi(c.id); onRefresh(); }}
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

function labelCard(card: Card): string {
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
      }}
      className="space-y-3"
    >
      <div className="flex gap-3 items-center">
        <label className="text-sm">タイプ</label>
        <Select value={type} onChange={(e) => setType(e.target.value as CardType)} className="max-w-[160px]">
          <option value="text">Text</option>
          <option value="quiz">Quiz</option>
          <option value="fill-blank">Fill‑blank</option>
        </Select>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="タイトル（任意）" className="flex-1" />
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
