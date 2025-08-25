"use client";

import { useState } from "react";
import { generateCoursePlan } from "@/lib/ai/mock";
import { commitCoursePlan, saveDraft } from "@/lib/localdb";
import type { CoursePlan } from "@/lib/types";
import { useRouter } from "next/navigation";

export default function PlanCoursePage() {
  const router = useRouter();
  const [theme, setTheme] = useState("");
  const [level, setLevel] = useState("");
  const [goal, setGoal] = useState("");
  const [lessonCount, setLessonCount] = useState(6);
  const [plan, setPlan] = useState<CoursePlan | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function onGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!theme.trim()) return alert("テーマは必須です");
    setLoading(true);
    // Mock generation
    const p = generateCoursePlan({ theme, level, goal, lessonCount });
    const draft = saveDraft("outline", p);
    setPlan(p);
    setDraftId(draft.id);
    setLoading(false);
  }

  function onCommit() {
    if (!draftId) return;
    const res = commitCoursePlan(draftId);
    if (!res) return alert("保存に失敗しました");
    router.replace(`/courses/${res.courseId}`);
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-xl font-semibold mb-4">AI コース設計（モック）</h1>
      <form onSubmit={onGenerate} className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium mb-1">テーマ</label>
          <input
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className="w-full border rounded px-3 py-2"
            placeholder="例: 機械学習 入門"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">レベル（任意）</label>
          <input
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="w-full border rounded px-3 py-2"
            placeholder="初級/中級/上級 など"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">目標（任意）</label>
          <input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            className="w-full border rounded px-3 py-2"
            placeholder="例: 3週間で基礎を習得"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">レッスン数</label>
          <input
            type="number"
            min={3}
            max={30}
            value={lessonCount}
            onChange={(e) => setLessonCount(Number(e.target.value))}
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded bg-black text-white disabled:opacity-60"
          >
            {loading ? "生成中..." : "コース案を生成"}
          </button>
        </div>
      </form>

      {plan && (
        <section className="border rounded-md p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-medium text-lg">{plan.course.title}</h2>
              {plan.course.description && (
                <p className="text-sm text-gray-600">{plan.course.description}</p>
              )}
            </div>
            <button onClick={onCommit} className="px-3 py-2 rounded bg-black text-white">
              保存して作成
            </button>
          </div>
          <ol className="mt-4 space-y-2 list-decimal list-inside">
            {plan.lessons.map((l, idx) => (
              <li key={idx}>
                <div>
                  <div className="font-medium">{l.title}</div>
                  {l.summary && (
                    <div className="text-sm text-gray-600">{l.summary}</div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

