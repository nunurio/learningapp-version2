"use client";
import * as React from "react";
import { Card } from "@/components/ui/card";
import {
  AlertTriangle,
  CheckCircle2,
  Dot,
  FlaskConical,
  LoaderCircle,
  Save,
  Sparkles,
  Wrench,
} from "lucide-react";

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

export function SSETimeline({
  logs,
  size = "normal",
  layout = "vertical",
}: {
  logs: SseLog[];
  size?: "normal" | "compact";
  layout?: "vertical" | "inline";
}) {
  const steps = toSteps(logs);
  const now = Date.now();
  const lastError = [...steps].reverse().find((s) => /^エラー/.test(s.label) || /error/i.test(s.label));

  type GroupId = "prep" | "gen" | "validate" | "persist" | "other";
type Lucide = React.ComponentType<React.SVGProps<SVGSVGElement>>;
type Group = { id: GroupId; label: string; Icon: Lucide; start?: number; end?: number };
  const GROUPS: Group[] = [
    { id: "prep", label: "準備", Icon: Wrench },
    { id: "gen", label: "生成", Icon: Sparkles },
    { id: "validate", label: "検証", Icon: FlaskConical },
    { id: "persist", label: "保存", Icon: Save },
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
    // Prefer the start of the next group; otherwise, the timestamp of the last
    // log in this group (not 'now' to avoid perpetual "active" state for final group).
    let end: number | undefined = undefined;
    if (start != null) {
      for (let j = i + 1; j < GROUPS.length; j++) {
        const nextIdx = groupIndex.get(GROUPS[j].id);
        if (nextIdx != null) { end = steps[nextIdx].start; break; }
      }
      if (end == null) {
        const lastOfGroup = [...steps].reverse().find((s) => matchGroup(s.label) === g.id);
        // 進行中は end を確定しない（start にはフォールバックしない）
        end = lastOfGroup?.end;
      }
    }
    return { ...g, start, end } as Group;
  });

  const anyStarted = groupsWithTimes.some((g) => g.start != null) || steps.length > 0;

  // density presets
  const isCompact = size === "compact";
  const cardPad = isCompact ? "p-2" : "p-3";
  const cardText = isCompact ? "text-[11px]" : "text-xs";
  const cardH = layout === "inline" ? "h-auto min-h-0" : isCompact ? "h-28 sm:h-32" : "h-48 sm:h-64";
  const listGap = isCompact ? "space-y-1" : "space-y-2";
  const alertPad = isCompact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-[11px]";
  const dotClass = isCompact ? "h-1.5 w-1.5 mt-[.28rem]" : "h-2 w-2 mt-[.3rem]";
  const labelFont = isCompact ? "font-mono" : "font-mono"; // keep same for readability
  const iconSize = isCompact ? "h-3.5 w-3.5" : "h-4 w-4";

  // inline (one-line) layout
  if (layout === "inline") {
    const tokens = GROUPS.map((g, i) => {
      const idx = groupIndex.get(g.id);
      const started = idx != null;
      const start = started ? steps[idx as number].start : undefined;
      let end: number | undefined = undefined;
      if (started) {
        for (let j = i + 1; j < GROUPS.length; j++) {
          const nextIdx = groupIndex.get(GROUPS[j].id);
          if (nextIdx != null) { end = steps[nextIdx].start; break; }
        }
        if (end == null) {
          const lastOfGroup = [...steps].reverse().find((s) => matchGroup(s.label) === g.id);
          // 進行中は end を確定しない（start にはフォールバックしない）
          end = lastOfGroup?.end;
        }
      }
      const done = started && end != null && end <= now;
      const active = started && !done;
      const Prefix = lastError && active ? AlertTriangle : active ? LoaderCircle : done ? CheckCircle2 : Dot;
      const color = lastError && active
        ? "text-[hsl(var(--destructive))]"
        : active
        ? "text-[hsl(var(--primary))]"
        : done
        ? "text-gray-700"
        : "text-gray-400";
      return { g, Prefix, color, active };
    });

    return (
      <Card
        className={`${cardPad} ${cardText} text-gray-800 ${cardH} flex flex-wrap items-center gap-x-1 gap-y-1 overflow-hidden`}
        role="status"
        aria-live="polite"
      >
        {lastError && <span role="alert" className="sr-only">エラー</span>}
        {tokens.map((t, i) => (
          <span key={t.g.id} className={`inline-flex items-center gap-1 ${labelFont}`}>
            <t.Prefix className={`${iconSize} ${t.active ? "animate-spin" : ""} ${t.color}`} aria-hidden />
            <t.g.Icon className={`${iconSize}`} aria-hidden />
            <span className={`${t.color}`}>{t.g.label}</span>
            {i < tokens.length - 1 && <span className="mx-1 text-gray-400" aria-hidden>→</span>}
          </span>
        ))}
      </Card>
    );
  }

  return (
    <Card className={`${cardPad} ${cardText} text-gray-800 ${cardH} overflow-auto`} role="status" aria-live="polite">
      {lastError && <div role="alert" className="sr-only">{lastError.label}</div>}
      {lastError && (
        <div className={`sticky top-0 z-10 mb-1.5 rounded border border-[hsl(var(--destructive))]/40 bg-[hsla(0,84%,60%,.08)] ${alertPad} text-[hsl(var(--destructive))]`}>
          <AlertTriangle className="inline-block mr-1 align-[-2px] h-4 w-4" aria-hidden />
          <span className="sr-only">エラー: </span>
          エラーが発生しました: <span className="font-mono">{lastError.label}</span>
        </div>
      )}
      {!anyStarted ? (
        <p className="text-gray-500">待機中…</p>
      ) : (
        <ol className={`${listGap}`}>
          {groupsWithTimes.map((g) => {
            const started = g.start != null;
            const currIdx = GROUPS.findIndex((gg) => gg.id === g.id);
            const done = started && g.end != null && g.end <= now;
            const active = started && !done;
            const duration = started ? (g.end ?? now) - (g.start as number) : 0;
            const dotColor = lastError && active ? "hsl(var(--destructive))" : active ? "hsl(var(--primary))" : started ? "rgba(0,0,0,.55)" : "rgba(0,0,0,.25)";
            return (
              <li key={g.id} className="pl-5">
                <span
                  className={`absolute -ml-4 inline-block rounded-full ${dotClass}`}
                  style={{ backgroundColor: dotColor }}
                  aria-hidden
                />
                <div className="flex items-center justify-between gap-2">
                  <span className={`${labelFont} inline-flex items-center gap-1.5`}>
                    {/* 状態アイコン（視覚用） + sr-only テキスト（読み上げ用） */}
                    {lastError && active ? (
                      <>
                        <AlertTriangle className={`${iconSize} text-[hsl(var(--destructive))]`} aria-hidden />
                        <span className="sr-only">エラー </span>
                      </>
                    ) : active ? (
                      <>
                        <LoaderCircle className={`${iconSize} animate-spin`} aria-hidden />
                        <span className="sr-only">進行中 </span>
                      </>
                    ) : started ? (
                      <>
                        <CheckCircle2 className={`${iconSize}`} aria-hidden />
                        <span className="sr-only">完了 </span>
                      </>
                    ) : (
                      <>
                        <Dot className={`${iconSize}`} aria-hidden />
                        <span className="sr-only">未開始 </span>
                      </>
                    )}
                    {/* グループアイコン + ラベル */}
                    <g.Icon className={`${iconSize}`} aria-hidden />
                    {g.label}
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
