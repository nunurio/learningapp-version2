"use client";
import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { listLessons, listCards, listFlaggedByCourse, getProgress, listCourses, useLocalDbVersion } from "@/lib/localdb";
import type { UUID, Card, Lesson, CardType, Course, QuizCardContent, FillBlankCardContent } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

type Props = {
  courseId: UUID;
  selectedId?: UUID;
  onSelect: (id: UUID, kind: "course" | "lesson" | "card" | "lesson-edit") => void;
};

export function NavTree({ courseId, selectedId, onSelect }: Props) {
  // DB変更に追従
  const dbv = useLocalDbVersion();
  const [q, setQ] = React.useState("");
  const [courses, setCourses] = React.useState<Course[]>([]);
  const [lessons, setLessons] = React.useState<Lesson[]>([]);
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [typeFilter, setTypeFilter] = React.useState<"all" | CardType>("all");
  const [onlyFlagged, setOnlyFlagged] = React.useState(false);
  const [onlyUnlearned, setOnlyUnlearned] = React.useState(false);
  const flaggedSet = new Set(listFlaggedByCourse(courseId));

  // ロービング tabindex 用の"アクティブ"項目管理
  const [activeId, setActiveId] = React.useState<string | undefined>(undefined);

  React.useEffect(() => {
    setCourses(listCourses());
    setLessons(listLessons(courseId));
    // 初期表示では現在のコースを展開
    setExpanded((m) => (m[`co:${courseId}`] ? m : { ...m, [`co:${courseId}`]: true }));
  }, [courseId, dbv]);

  // 可視行をフラット化
  type Row = { key: string; type: "course" | "lesson" | "card"; id: string; level: number; title: string; tags?: string[]; completed?: boolean; expanded?: boolean };
  const rows: Row[] = (() => {
    const out: Row[] = [];
    const match = (s: string) => (q ? s.toLowerCase().includes(q.toLowerCase()) : true);
    // コース → レッスン → カード
    courses.forEach((co) => {
      // 子どもに検索/フィルタがかかっていれば親は表示
      const ls = listLessons(co.id);
      const hasChild = ls.some((l) => {
        const cs = listCards(l.id);
        return (
          match(l.title) ||
          cs.some((c) => {
            if (typeFilter !== "all" && c.cardType !== typeFilter) return false;
            if (onlyFlagged && !flaggedSet.has(c.id)) return false;
            if (onlyUnlearned && getProgress(c.id)?.completed) return false;
            return match(c.title ?? "") || match(c.cardType);
          })
        );
      });
      if (!(match(co.title) || hasChild)) return;

      out.push({ key: `co:${co.id}`, type: "course", id: co.id, level: 1, title: co.title, expanded: !!expanded[`co:${co.id}`] });
      if (expanded[`co:${co.id}`]) {
        ls.forEach((l) => {
          const childAny = (() => {
            const cs = listCards(l.id);
            return cs.some((c) => {
              if (typeFilter !== "all" && c.cardType !== typeFilter) return false;
              if (onlyFlagged && !flaggedSet.has(c.id)) return false;
              if (onlyUnlearned && getProgress(c.id)?.completed) return false;
              return match(c.title ?? "") || match(c.cardType);
            });
          })();
          if (!(match(l.title) || childAny)) return;
          out.push({ key: `l:${l.id}`, type: "lesson", id: l.id, level: 2, title: l.title, expanded: !!expanded[`le:${l.id}`] });
          if (expanded[`le:${l.id}`]) {
            const cs = listCards(l.id);
            cs.forEach((c) => {
              if (typeFilter !== "all" && c.cardType !== typeFilter) return;
              if (onlyFlagged && !flaggedSet.has(c.id)) return;
              if (onlyUnlearned && getProgress(c.id)?.completed) return;
              if (match(c.title ?? "") || match(c.cardType))
                out.push({ key: `c:${c.id}`, type: "card", id: c.id, level: 3, title: labelForCard(c), tags: c.tags ?? [], completed: !!getProgress(c.id)?.completed });
            });
          }
        });
      }
    });
    return out;
  })();

  // レッスン単位の進捗率
  const lessonProgress = (() => {
    const map = new Map<string, number>();
    for (const l of lessons) {
      const cs = listCards(l.id);
      if (cs.length === 0) { map.set(l.id, 0); continue; }
      const done = cs.reduce((acc, c) => acc + (getProgress(c.id)?.completed ? 1 : 0), 0);
      map.set(l.id, Math.round((done / cs.length) * 100));
    }
    return map;
  })();

  // バーチャルリスト（@tanstack/react-virtual）
  const COURSE_H = 40; // px
  const LESSON_H = 36; // px
  const CARD_H = 28; // px
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: (index) => (rows[index]?.type === "course" ? COURSE_H : rows[index]?.type === "lesson" ? LESSON_H : CARD_H),
    overscan: 6,
  });

  // 初回フォーカス時に先頭へロービング
  const onTreeFocus = () => {
    if (!containerRef.current) return;
    const hasFocusedItem = !!containerRef.current.querySelector('[role="treeitem"][tabindex="0"]');
    if (!hasFocusedItem && rows.length) setActiveId(rows[0].id);
  };

  // APG 準拠のキーボードモデル
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!rows.length) return;
    const idx = rows.findIndex((r) => r.id === activeId);
    const cur = rows[Math.max(0, idx)];
    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault();
        const nextIndex = Math.min(rows.length - 1, Math.max(0, idx + 1));
        const next = rows[nextIndex];
        setActiveId(next.id);
        rowVirtualizer.scrollToIndex(nextIndex, { align: "auto" });
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        const prevIndex = Math.max(0, idx - 1);
        const prev = rows[prevIndex];
        setActiveId(prev.id);
        rowVirtualizer.scrollToIndex(prevIndex, { align: "auto" });
        break;
      }
      case "Home": {
        e.preventDefault();
        setActiveId(rows[0].id);
        rowVirtualizer.scrollToIndex(0, { align: "start" });
        break;
      }
      case "End": {
        e.preventDefault();
        const last = rows.length - 1;
        setActiveId(rows[last].id);
        rowVirtualizer.scrollToIndex(last, { align: "end" });
        break;
      }
      case "ArrowRight": {
        if (cur?.type === "course") {
          const k = `co:${cur.id}`;
          const isOpen = !!expanded[k];
          if (!isOpen) { e.preventDefault(); setExpanded((m) => ({ ...m, [k]: true })); }
        } else if (cur?.type === "lesson") {
          const k = `le:${cur.id}`;
          const isOpen = !!expanded[k];
          if (!isOpen) {
            e.preventDefault();
            setExpanded((m) => ({ ...m, [k]: true }));
          } else {
            // 最初の子へ
            const next = rows[idx + 1];
            if (next?.type === "card") {
              e.preventDefault();
              setActiveId(next.id);
              rowVirtualizer.scrollToIndex(idx + 1, { align: "auto" });
            }
          }
        }
        break;
      }
      case "ArrowLeft": {
        if (cur?.type === "course") {
          const k = `co:${cur.id}`;
          const isOpen = !!expanded[k];
          if (isOpen) { e.preventDefault(); setExpanded((m) => ({ ...m, [k]: false })); }
        } else if (cur?.type === "lesson") {
          const k = `le:${cur.id}`;
          const isOpen = !!expanded[k];
          if (isOpen) { e.preventDefault(); setExpanded((m) => ({ ...m, [k]: false })); }
        } else if (cur?.type === "card") {
          // 親のレッスンへ移動
          for (let i = idx - 1; i >= 0; i--) {
            if (rows[i].type === "lesson") { e.preventDefault(); setActiveId(rows[i].id); rowVirtualizer.scrollToIndex(i, { align: "auto" }); break; }
          }
        }
        break;
      }
      case "Enter": {
        e.preventDefault();
        if (cur) onSelect(cur.id as UUID, cur.type);
        break;
      }
      case " ": {
        if (cur?.type === "course") {
          e.preventDefault();
          setExpanded((m) => ({ ...m, [`co:${cur.id}`]: !m[`co:${cur.id}`] }));
        } else if (cur?.type === "lesson") {
          e.preventDefault();
          setExpanded((m) => ({ ...m, [`le:${cur.id}`]: !m[`le:${cur.id}`] }));
        }
        break;
      }
    }
  };

  return (
    <aside className="h-full flex flex-col">
      <div className="p-2 border-b grid grid-cols-1 gap-2">
        <div>
          <label className="sr-only" htmlFor="tree-search">検索</label>
          <Input id="tree-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="検索（タイトル/タイプ）" />
        </div>
        <div className="flex items-center gap-2 text-xs">
          <label className="text-gray-600" htmlFor="type-filter">種類</label>
          <Select id="type-filter" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as "all" | CardType)} className="max-w-[140px]">
            <option value="all">すべて</option>
            <option value="text">Text</option>
            <option value="quiz">Quiz</option>
            <option value="fill-blank">Fill‑blank</option>
          </Select>
          <label className="inline-flex items-center gap-1 ml-2">
            <input type="checkbox" checked={onlyFlagged} onChange={(e) => setOnlyFlagged(e.target.checked)} />
            フラグのみ
          </label>
          <label className="inline-flex items-center gap-1 ml-2">
            <input type="checkbox" checked={onlyUnlearned} onChange={(e) => setOnlyUnlearned(e.target.checked)} />
            未学習のみ
          </label>
        </div>
      </div>
      <div
        ref={containerRef}
        role="tree"
        aria-label="コース構造"
        className="flex-1 overflow-auto py-2"
        onKeyDown={onKeyDown}
        onFocus={onTreeFocus}
        tabIndex={0}
      >
        <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
          {rowVirtualizer.getVirtualItems().map((vi) => {
            const r = rows[vi.index];
            return (
              <div
                key={r.key}
                style={{ position: "absolute", top: 0, left: 0, right: 0, transform: `translateY(${vi.start}px)` }}
              >
                {r.type === "course" ? (
                  <TreeCourseRow
                    id={r.id}
                    title={r.title}
                    level={1}
                    expanded={!!expanded[`co:${r.id}`]}
                    selected={r.id === courseId}
                    active={activeId === r.id}
                    onClick={() => onSelect(r.id as UUID, "course")}
                    onToggle={() => setExpanded((m) => ({ ...m, [`co:${r.id}`]: !m[`co:${r.id}`] }))}
                    onActive={() => setActiveId(r.id)}
                  />
                ) : r.type === "lesson" ? (
                  <TreeLessonRow
                    id={r.id}
                    title={r.title}
                    level={2}
                    expanded={!!expanded[`le:${r.id}`]}
                    selected={selectedId === r.id}
                    active={activeId === r.id}
                    progressPct={lessonProgress.get(r.id) ?? 0}
                    onClick={() => onSelect(r.id as UUID, "lesson")}
                    onToggle={() => setExpanded((m) => ({ ...m, [`le:${r.id}`]: !m[`le:${r.id}`] }))}
                    onActive={() => setActiveId(r.id)}
                    onEdit={() => onSelect(r.id as UUID, "lesson-edit")}
                  />
                ) : (
                  <TreeCardRow
                    id={r.id}
                    title={r.title}
                    level={3}
                    selected={selectedId === r.id}
                    active={activeId === r.id}
                    tags={r.tags ?? []}
                    completed={!!r.completed}
                    onClick={() => onSelect(r.id as UUID, "card")}
                    onActive={() => setActiveId(r.id)}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

function Chevron({ open, size = 18 }: { open: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      className={`transition-transform ${open ? "rotate-90" : "rotate-0"}`}
    >
      <path d="M8 5l8 7-8 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// 行頭アイコンは不要要件のため削除（Chevron=開閉トグルのみ残す）

function TreeCourseRow({ id, title, level, expanded, selected, active, onClick, onToggle, onActive }:{
  id: string;
  title: string;
  level: number;
  expanded: boolean;
  selected: boolean; // current course
  active: boolean;
  onClick: () => void;
  onToggle: () => void;
  onActive: () => void;
}) {
  return (
    <div className="px-2" style={{ paddingLeft: (level - 1) * 14 }}>
      <div
        role="treeitem"
        aria-level={level}
        aria-expanded={expanded}
        aria-selected={selected}
        tabIndex={active ? 0 : -1}
        data-id={id}
        data-type="course"
        onFocus={onActive}
        onClick={onClick}
        className="group relative flex items-center gap-2 h-10 px-2 rounded hover:bg-[hsl(var(--accent))] focus-visible:bg-[hsl(var(--accent))] cursor-pointer data-[sel=true]:bg-[hsl(var(--accent))] data-[sel=true]:ring-1 data-[sel=true]:ring-[hsl(var(--primary))]/30 transition-colors"
        data-sel={selected}
      >
        <span aria-hidden className="pointer-events-none absolute left-0 top-1 bottom-1 w-1 rounded bg-[hsl(var(--primary))]/30 origin-left scale-x-0 group-hover:scale-x-100 group-focus-within:scale-x-100 transition-transform duration-150" />
        <button
          aria-label={expanded ? "折りたたむ" : "展開"}
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className="inline-flex items-center justify-center size-6 rounded hover:bg-black/5"
        >
          <Chevron open={expanded} />
        </button>
        <span className="truncate font-semibold">{title}</span>
      </div>
    </div>
  );
}

function TreeLessonRow({ id, title, level, expanded, selected, active, progressPct, onClick, onToggle, onActive, onEdit }:{
  id: string;
  title: string;
  level: number;
  expanded: boolean;
  selected: boolean;
  active: boolean;
  progressPct: number;
  onClick: () => void;
  onToggle: () => void;
  onActive: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="px-2" style={{ paddingLeft: (level - 1) * 14 }}>
      <div
        role="treeitem"
        aria-level={level}
        aria-expanded={expanded}
        aria-selected={selected}
        tabIndex={active ? 0 : -1}
        data-id={id}
        data-type="lesson"
        onFocus={onActive}
        onClick={onClick}
        className="group relative flex items-center gap-2 h-9 px-2 rounded hover:bg-[hsl(var(--accent))] focus-visible:bg-[hsl(var(--accent))] cursor-pointer data-[sel=true]:bg-[hsl(var(--accent))] data-[sel=true]:ring-1 data-[sel=true]:ring-[hsl(var(--primary))]/30 transition-colors"
        data-sel={selected}
      >
        <span aria-hidden className="pointer-events-none absolute left-0 top-1 bottom-1 w-1 rounded bg-[hsl(var(--primary))]/30 origin-left scale-x-0 group-hover:scale-x-100 group-focus-within:scale-x-100 transition-transform duration-150" />
        <button
          aria-label={expanded ? "折りたたむ" : "展開"}
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className="inline-flex items-center justify-center size-6 rounded hover:bg-black/5"
        >
          <Chevron open={expanded} />
        </button>
        <ProgressRing value={progressPct} size={14} stroke={2} title={`完了 ${progressPct}%`} />
        <span className="truncate font-medium flex-1">{title}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label="レッスンメニュー"
              className="inline-flex items-center justify-center size-6 rounded hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]"
              onClick={(e) => e.stopPropagation()}
            >
              <span aria-hidden>⋯</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={() => onEdit()}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(); }}
            >
              レッスンを編集（AI生成）
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function TreeCardRow({ id, title, level, selected, active, tags, completed, onClick, onActive }:{
  id: string;
  title: string;
  level: number;
  selected: boolean;
  active: boolean;
  tags: string[];
  completed: boolean;
  onClick: () => void;
  onActive: () => void;
}) {
  return (
    <div role="group" className="">
      <div className="px-2" style={{ paddingLeft: (level - 1) * 14 }}>
        <div
          role="treeitem"
          aria-level={level}
          aria-selected={selected}
          tabIndex={active ? 0 : -1}
          data-id={id}
          data-type="card"
          onFocus={onActive}
          onClick={onClick}
          className="group relative flex items-center gap-2 h-7 px-2 rounded hover:bg-[hsl(var(--accent))] focus-visible:bg-[hsl(var(--accent))] cursor-pointer data-[sel=true]:bg-[hsl(var(--accent))] data-[sel=true]:ring-1 data-[sel=true]:ring-[hsl(var(--primary))]/30 transition-colors"
          data-sel={selected}
        >
          <span aria-hidden className="pointer-events-none absolute left-0 top-1 bottom-1 w-1 rounded bg-[hsl(var(--primary))]/30 origin-left scale-x-0 group-hover:scale-x-100 group-focus-within:scale-x-100 transition-transform duration-150" />
          <ProgressRing value={completed ? 100 : 0} size={12} stroke={2} title={completed ? "完了" : "未完了"} />
          <span className="truncate">{title}</span>
          {tags?.length ? (
            <span className="ml-2 flex items-center gap-1 overflow-hidden">
              {tags.slice(0, 3).map((t, i) => (
                <Badge key={i} variant="secondary" className="text-[10px] px-1 py-0">{t}</Badge>
              ))}
              {tags.length > 3 ? <Badge variant="secondary" className="text-[10px] px-1 py-0">+{tags.length - 3}</Badge> : null}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function labelForCard(card: Card): string {
  if (card.cardType === "text") return "テキスト";
  if (card.cardType === "quiz") return (card.content as QuizCardContent).question ?? "クイズ";
  return (card.content as FillBlankCardContent).text?.replace(/\[\[(\d+)\]\]/g, "□") ?? "穴埋め";
}
