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

