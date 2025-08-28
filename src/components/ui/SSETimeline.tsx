"use client";
import * as React from "react";
import { Card } from "@/components/ui/card";

export type SseLog = { ts: number; text: string };

type Step = {
  label: string;
  start: number;
  end?: number;
};

function toSteps(logs: SseLog[]): Step[] {
  const steps: Step[] = [];
  for (const l of logs) {
    const label = (l.text || "").trim();
    if (!label) continue;
    const prev = steps[steps.length - 1];
    if (prev && prev.label === label && !prev.end) {
      prev.end = l.ts; // refresh end for consecutive duplicates
    } else {
      steps.push({ label, start: l.ts });
    }
  }
  return steps;
}

function fmt(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 100) / 10;
  return `${s}s`;
}

export function SSETimeline({ logs }: { logs: SseLog[] }) {
  const steps = toSteps(logs);
  const now = Date.now();
  const lastError = [...steps].reverse().find((s) => /^エラー/.test(s.label) || /error/i.test(s.label));

  type GroupId = "prep" | "gen" | "validate" | "persist" | "other";
  type Group = { id: GroupId; label: string; icon: string; start?: number; end?: number };
  const GROUPS: Group[] = [
    { id: "prep", label: "準備", icon: "🧰" },
    { id: "gen", label: "生成", icon: "✨" },
    { id: "validate", label: "検証", icon: "🧪" },
    { id: "persist", label: "保存", icon: "💾" },
  ];

  const matchGroup = (label: string): GroupId => {
    if (/(received|normalizeInput|expandContext)/i.test(label)) return "prep";
    if (/(planCourse|generateCards)/i.test(label)) return "gen";
    if (/(validatePlan|validateSchema)/i.test(label)) return "validate";
    if (/(persistPreview|保存)/i.test(label)) return "persist";
    return "other";
  };

  // Determine first appearance times for each group in logical order
  const groupIndex = new Map<GroupId, number>();
  steps.forEach((s, idx) => {
    const gid = matchGroup(s.label);
    if (!groupIndex.has(gid)) groupIndex.set(gid, idx);
  });
  const groupsWithTimes = GROUPS.map((g, i) => {
    const idx = groupIndex.get(g.id);
    const start = idx != null ? steps[idx].start : undefined;
    // end is the start of the next seen group, else last seen step of this group, else now
    let end: number | undefined = undefined;
    if (start != null) {
      // find first later group that has a start
      for (let j = i + 1; j < GROUPS.length; j++) {
        const nextIdx = groupIndex.get(GROUPS[j].id);
        if (nextIdx != null) { end = steps[nextIdx].start; break; }
      }
      if (end == null) {
        // try to find last step of same group
        const lastOfGroup = [...steps].reverse().find((s) => matchGroup(s.label) === g.id);
        end = lastOfGroup?.end ?? now;
      }
    }
    return { ...g, start, end } as Group;
  });

  const anyStarted = groupsWithTimes.some((g) => g.start != null) || steps.length > 0;

  return (
    <Card className="p-3 text-xs text-gray-800 h-48 sm:h-64 overflow-auto" role="status" aria-live="polite">
      {lastError && <div role="alert" className="sr-only">{lastError.label}</div>}
      {!anyStarted ? (
        <p className="text-gray-500">待機中…</p>
      ) : (
        <ol className="space-y-2">
          {groupsWithTimes.map((g) => {
            const started = g.start != null;
            const done = started && g.end != null && g.end < now && groupIndex.has(g.id) && GROUPS.indexOf(g as any) < GROUPS.length - 1 && groupsWithTimes.find((x) => x.id === g.id)?.end !== g.start; // heuristic
            const active = started && !done;
            const duration = started ? (g.end ?? now) - (g.start as number) : 0;
            const dotColor = lastError && active ? "hsl(var(--destructive))" : active ? "hsl(var(--primary))" : started ? "rgba(0,0,0,.55)" : "rgba(0,0,0,.25)";
            return (
              <li key={g.id} className="pl-5">
                <span
                  className="absolute -ml-4 mt-[.3rem] inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: dotColor }}
                  aria-hidden
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono">
                    {lastError && active ? "⚠️ " : active ? "⏳ " : started ? "✔︎ " : "• "}
                    {g.icon} {g.label}
                  </span>
                  {started && <span className="text-[10px] text-gray-500">{fmt(duration)}</span>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
