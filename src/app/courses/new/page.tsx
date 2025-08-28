"use client";

import { useState } from "react";
import { createCourse } from "@/lib/localdb";
import { useRouter } from "next/navigation";
import { Header } from "@/components/ui/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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
    <div className="min-h-screen">
      <Header />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-xl font-semibold mb-4">コースを手動で作成</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">タイトル</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例: JavaScript 基礎"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">説明（任意）</label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="コースの概要"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">カテゴリ（任意）</label>
          <Input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="General など"
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" variant="default">作成</Button>
        </div>
      </form>
      </div>
    </div>
  );
}
