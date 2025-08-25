"use client";

import { useState } from "react";
import { createCourse } from "@/lib/localdb";
import { useRouter } from "next/navigation";

export default function NewCoursePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return alert("タイトルは必須です");
    const { courseId } = createCourse({ title, description, category });
    router.replace(`/courses/${courseId}`);
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-xl font-semibold mb-4">コースを手動で作成</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">タイトル</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border rounded px-3 py-2"
            placeholder="例: JavaScript 基礎"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">説明（任意）</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border rounded px-3 py-2 min-h-24"
            placeholder="コースの概要"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">カテゴリ（任意）</label>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full border rounded px-3 py-2"
            placeholder="General など"
          />
        </div>
        <div className="flex gap-2">
          <button type="submit" className="px-4 py-2 rounded bg-black text-white">
            作成
          </button>
        </div>
      </form>
    </div>
  );
}

