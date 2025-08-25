"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  getCourse,
  listLessons,
  addLesson,
  deleteLesson,
  reorderLessons,
  updateCourse,
  commitLessonCards,
  saveDraft,
} from "@/lib/localdb";
import type { Course, Lesson, LessonCards } from "@/lib/types";
import { generateLessonCards } from "@/lib/ai/mock";

export default function CourseDetailPage() {
  const router = useRouter();
  const params = useParams<{ courseId: string }>();
  const courseId = params.courseId;
  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [newLessonTitle, setNewLessonTitle] = useState("");

  // Preview state per lesson
  const [previews, setPreviews] = useState<Record<string, { draftId: string; payload: LessonCards }>>({});

  function refresh() {
    const c = getCourse(courseId);
    setCourse(c ?? null);
    setLessons(listLessons(courseId));
  }

  useEffect(() => {
    refresh();
  }, [courseId]);

  const onAddLesson = () => {
    if (!newLessonTitle.trim()) return;
    addLesson(courseId, newLessonTitle);
    setNewLessonTitle("");
    refresh();
  };

  function onDeleteLesson(id: string) {
    if (!confirm("このレッスンを削除しますか？")) return;
    deleteLesson(id);
    refresh();
  }

  // DnD helpers
  const [dragId, setDragId] = useState<string | null>(null);
  function onDragStart(e: React.DragEvent<HTMLLIElement>, id: string) {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
  }
  function onDragOver(e: React.DragEvent<HTMLLIElement>) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }
  function onDrop(e: React.DragEvent<HTMLLIElement>, targetId: string) {
    e.preventDefault();
    if (!dragId || dragId === targetId) return;
    const ids = lessons.map((l) => l.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    reorderLessons(courseId, ids);
    setDragId(null);
    refresh();
  }

  function onGenerateCards(lesson: Lesson) {
    const payload = generateLessonCards({ lessonTitle: lesson.title, desiredCount: 6 });
    const draft = saveDraft("lesson-cards", payload);
    setPreviews((prev) => ({ ...prev, [lesson.id]: { draftId: draft.id, payload } }));
  }

  function onCommitCards(lesson: Lesson) {
    const p = previews[lesson.id];
    if (!p) return;
    const res = commitLessonCards({ draftId: p.draftId, lessonId: lesson.id });
    if (!res) return alert("保存に失敗しました");
    setPreviews((prev) => {
      const copy = { ...prev };
      delete copy[lesson.id];
      return copy;
    });
    router.push(`/courses/${courseId}/lessons/${lesson.id}`);
  }

  if (!course) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <p className="text-sm text-gray-600">コースが見つかりませんでした。</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <header className="mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">{course.title}</h1>
          <Link href={`/learn/${course.id}`} className="px-3 py-2 rounded border hover:bg-black/5">
            学習する
          </Link>
        </div>
        {course.description && (
          <p className="text-sm text-gray-600 mt-1">{course.description}</p>
        )}
      </header>

      <section className="mb-4">
        <h2 className="font-medium mb-2">レッスン</h2>
        <div className="flex gap-2 mb-3">
          <input
            value={newLessonTitle}
            onChange={(e) => setNewLessonTitle(e.target.value)}
            placeholder="レッスン名"
            className="flex-1 border rounded px-3 py-2"
          />
          <button onClick={onAddLesson} className="px-3 py-2 rounded bg-black text-white">
            追加
          </button>
        </div>
        <ul className="space-y-2">
          {lessons.map((l) => (
            <li
              key={l.id}
              className="border rounded p-3"
              draggable
              onDragStart={(e) => onDragStart(e, l.id)}
              onDragOver={onDragOver}
              onDrop={(e) => onDrop(e, l.id)}
            >
              <div className="flex items-center gap-2">
                <span className="cursor-move select-none text-gray-500">≡</span>
                <span className="font-medium flex-1">{l.title}</span>
                <Link
                  href={`/courses/${courseId}/lessons/${l.id}`}
                  className="text-sm px-2 py-1 rounded border hover:bg-black/5"
                >
                  カード管理
                </Link>
                <button
                  onClick={() => onGenerateCards(l)}
                  className="text-sm px-2 py-1 rounded border hover:bg-black/5"
                >
                  AIでカード生成
                </button>
                <button
                  onClick={() => onDeleteLesson(l.id)}
                  className="text-sm px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50"
                >
                  削除
                </button>
              </div>
              {previews[l.id] && (
                <div className="mt-3 border-t pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-gray-600">プレビュー: {previews[l.id].payload.cards.length} 件</div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => onCommitCards(l)}
                        className="text-sm px-2 py-1 rounded bg-black text-white"
                      >
                        保存
                      </button>
                      <button
                        onClick={() =>
                          setPreviews((prev) => {
                            const copy = { ...prev };
                            delete copy[l.id];
                            return copy;
                          })
                        }
                        className="text-sm px-2 py-1 rounded border"
                      >
                        破棄
                      </button>
                    </div>
                  </div>
                  <ol className="text-sm space-y-1 list-decimal list-inside">
                    {previews[l.id].payload.cards.map((c, idx) => (
                      <li key={idx}>
                        <span className="px-1 py-0.5 rounded bg-black/5 mr-2">{c.type}</span>
                        {"title" in c && c.title ? c.title : c.type === "text" ? "テキスト" : "カード"}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

