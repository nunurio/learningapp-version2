"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listCourses, deleteCourse } from "@/lib/localdb";
import type { Course } from "@/lib/types";

export default function Home() {
  const [courses, setCourses] = useState<Course[]>([]);

  useEffect(() => {
    setCourses(listCourses());
  }, []);

  function refresh() {
    setCourses(listCourses());
  }

  return (
    <div className="min-h-screen max-w-5xl mx-auto px-6 py-10">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold">Learnify</h1>
        <nav className="flex gap-3">
          <Link
            href="/courses/plan"
            className="px-3 py-2 rounded-md bg-black text-white hover:opacity-90"
          >
            AIで作る
          </Link>
          <Link
            href="/courses/new"
            className="px-3 py-2 rounded-md border border-black/15 hover:bg-black/5"
          >
            手動で作る
          </Link>
        </nav>
      </header>

      <section>
        <h2 className="text-lg font-medium mb-3">あなたのコース</h2>
        {courses.length === 0 ? (
          <p className="text-sm text-gray-600">
            まだコースがありません。上の「AIで作る」または「手動で作る」から開始してください。
          </p>
        ) : (
          <ul className="grid sm:grid-cols-2 gap-4">
            {courses.map((c) => (
              <li key={c.id} className="border rounded-md p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-medium">{c.title}</h3>
                    {c.description ? (
                      <p className="text-sm text-gray-600 line-clamp-2">{c.description}</p>
                    ) : null}
                    <p className="text-xs text-gray-500 mt-1">{c.status}</p>
                  </div>
                </div>
                <div className="flex gap-2 mt-auto">
                  <Link
                    href={`/learn/${c.id}`}
                    className="text-sm px-3 py-1.5 rounded border border-black/15 hover:bg-black/5"
                  >
                    学習する
                  </Link>
                  <Link
                    href={`/courses/${c.id}`}
                    className="text-sm px-3 py-1.5 rounded border border-black/15 hover:bg-black/5"
                  >
                    編集
                  </Link>
                  <button
                    onClick={() => {
                      if (confirm("本当に削除しますか？ この操作は元に戻せません。")) {
                        deleteCourse(c.id);
                        refresh();
                      }
                    }}
                    className="ml-auto text-sm px-3 py-1.5 rounded border border-red-200 text-red-600 hover:bg-red-50"
                  >
                    削除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
