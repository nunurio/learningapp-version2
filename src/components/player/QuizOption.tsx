"use client";
import * as React from "react";
import { cn } from "@/lib/utils/cn";

type QuizOptionProps = {
  id: string;
  label: string;
  checked: boolean;
  onSelect: () => void;
  disabled?: boolean;
};

export function QuizOption({ id, label, checked, onSelect, disabled }: QuizOptionProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      id={id}
      tabIndex={checked ? 0 : -1}
      onClick={onSelect}
      onKeyDown={(e) => {
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
          // ラジオの矢印キー操作は選択を移動させるのが慣例
          const target = items[next];
          target.focus();
          (target as HTMLButtonElement).click();
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
            (first as HTMLButtonElement).click();
          }
        } else if (e.key === "End") {
          e.preventDefault();
          const current = e.currentTarget as HTMLElement;
          const group = current.closest('[role="radiogroup"]');
          const items = group ? Array.from(group.querySelectorAll<HTMLElement>('[role="radio"]:not([aria-disabled="true"])')) : [];
          const last = items[items.length - 1];
          if (last) {
            last.focus();
            (last as HTMLButtonElement).click();
          }
        }
      }}
      className={cn(
        "w-full text-left rounded-md border border-[hsl(var(--border))] px-4 py-3",
        checked && "outline outline-2 outline-[hsl(var(--primary))]"
      )}
      data-checked={checked}
    >
      <span className="inline-flex items-center gap-2">
        <span aria-hidden className={cn("size-4 rounded-full border", checked && "bg-[hsl(var(--primary))]")} />
        {label}
      </span>
    </button>
  );
}
