"use client";
import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { listCourses, listLessons } from "@/lib/client-api";

type Cmd = { id: string; label: string; hint?: string; action: () => void };

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [courses, setCourses] = useState<any[]>([]);
  const [lessons, setLessons] = useState<{ courseId: string; lessonId: string; title: string }[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const cs = await listCourses();
      if (!mounted) return;
      setCourses(cs);
      const all: { courseId: string; lessonId: string; title: string }[] = [];
      for (const c of cs) {
        const ls = await listLessons(c.id);
        if (!mounted) return;
        ls.forEach((l) => all.push({ courseId: c.id, lessonId: l.id, title: `${c.title} / ${l.title}` }));
      }
      if (!mounted) return;
      setLessons(all);
    })();
    return () => { mounted = false; };
  }, []);

  // Global shortcuts: Cmd/Ctrl+K toggles
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((s) => !s);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // External open via CustomEvent
  useEffect(() => {
    function onOpen() { setOpen(true); }
    window.addEventListener("open-command-palette", onOpen);
    return () => window.removeEventListener("open-command-palette", onOpen);
  }, []);

  const cmds = useMemo(() => {
    const base: Cmd[] = [
      { id: "home", label: "ダッシュボードへ移動", hint: "/", action: () => router.push("/") },
      { id: "plan", label: "AIでコース作成", hint: "/courses/plan", action: () => router.push("/courses/plan") },
      { id: "new", label: "手動でコース作成", hint: "/courses/new", action: () => router.push("/courses/new") },
    ];
    const courseCmds: Cmd[] = courses.flatMap((c) => [
      { id: `open-${c.id}` , label: `ワークスペースを開く: ${c.title}`, hint: "/courses/[id]/workspace", action: () => router.push(`/courses/${c.id}/workspace`) },
    ]);
    const lessonCmds: Cmd[] = lessons.map((l) => ({
      id: `cards-${l.lessonId}`,
      label: `ワークスペースで開く: ${l.title}`,
      hint: "/courses/[id]/workspace",
      action: () => router.push(`/courses/${l.courseId}/workspace`),
    }));
    const all = [...base, ...courseCmds, ...lessonCmds];
    const kw = q.trim().toLowerCase();
    if (!kw) return all;
    return all.filter((c) => c.label.toLowerCase().includes(kw));
  }, [q, courses, lessons, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-0 overflow-hidden w-[calc(100vw-1.5rem)] sm:w-auto sm:max-w-xl">
        <DialogTitle className="sr-only">コマンドパレット</DialogTitle>
        <div className="border-b border-[hsl(var(--border))] p-3">
          <label className="sr-only" htmlFor="cmdk-input">コマンド検索</label>
          <Input
            id="cmdk-input"
            placeholder="検索またはコマンド… (⌘K)"
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="max-h-[60vh] overflow-auto">
          {cmds.length === 0 ? (
            <div className="p-4 text-sm text-gray-600">該当するコマンドはありません。</div>
          ) : (
            <ul role="listbox" aria-label="コマンド結果" className="divide-y divide-[hsl(var(--border))]">
              {cmds.map((c) => (
                <li key={c.id} role="option" aria-selected={false}>
                  <button
                    type="button"
                    onClick={() => { setOpen(false); setQ(""); setTimeout(() => c.action(), 0); }}
                    className="w-full text-left p-3 hover:bg-[hsl(var(--muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus))]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span>{c.label}</span>
                      {c.hint && <span className="text-xs text-gray-500">{c.hint}</span>}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Fire this from anywhere to open the palette
export function openCommandPalette() {
  window.dispatchEvent(new CustomEvent("open-command-palette"));
}
