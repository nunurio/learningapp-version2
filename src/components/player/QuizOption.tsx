"use client";
import * as React from "react";
import { cn } from "@/lib/utils/cn";
import MarkdownView from "@/components/markdown/MarkdownView";

type QuizOptionProps = {
  id: string;
  label: string;
  checked: boolean;
  onSelect: () => void;
  disabled?: boolean;
};

export function QuizOption({ id, label, checked, onSelect, disabled }: QuizOptionProps) {
  return (
    <div
      role="radio"
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      id={id}
      tabIndex={checked ? 0 : -1}
      onClick={() => {
        if (disabled) return;
        onSelect();
      }}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
          return;
        }
        const move = (delta: -1 | 1) => {
          const current = e.currentTarget as HTMLElement;
          const group = current.closest('[role="radiogroup"]');
          if (!group) return;
          const items = Array.from(group.querySelectorAll<HTMLElement>('[role="radio"]:not([aria-disabled="true"])'));
          const idx = items.indexOf(current);
          if (idx === -1) return;
          const next = (idx + delta + items.length) % items.length;
          const target = items[next];
          target.focus();
          (target as HTMLElement).click();
        };
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          e.preventDefault();
          move(1);
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault();
          move(-1);
        } else if (e.key === "Home") {
          e.preventDefault();
          const current = e.currentTarget as HTMLElement;
          const group = current.closest('[role="radiogroup"]');
          const first = group?.querySelector<HTMLElement>('[role="radio"]:not([aria-disabled="true"])');
          if (first) {
            first.focus();
            (first as HTMLElement).click();
          }
        } else if (e.key === "End") {
          e.preventDefault();
          const current = e.currentTarget as HTMLElement;
          const group = current.closest('[role="radiogroup"]');
          const items = group ? Array.from(group.querySelectorAll<HTMLElement>('[role="radio"]:not([aria-disabled="true"])')) : [];
          const last = items[items.length - 1];
          if (last) {
            last.focus();
            (last as HTMLElement).click();
          }
        }
      }}
      className={cn(
        "w-full cursor-pointer rounded-md border border-[hsl(var(--border))] px-4 py-3 text-left transition-shadow",
        checked && "outline outline-2 outline-[hsl(var(--primary))] shadow-sm",
        disabled && "pointer-events-none opacity-60"
      )}
      data-checked={checked}
      data-disabled={disabled || undefined}
    >
      <span className="flex items-start gap-3">
        <span aria-hidden className={cn("mt-1 size-4 rounded-full border", checked && "bg-[hsl(var(--primary))]")} />
        <MarkdownView
          markdown={label}
          variant="inline"
          className="markdown-body text-sm leading-relaxed text-gray-900"
        />
      </span>
    </div>
  );
}
