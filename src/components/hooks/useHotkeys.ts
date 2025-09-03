"use client";
import { useEffect } from "react";

export type HotkeyMap = Record<string, (e: KeyboardEvent) => void>;

function isEditableTarget(el: EventTarget | null) {
  const t = el as HTMLElement | null;
  if (!t) return false;
  const tag = t.tagName?.toLowerCase();
  return tag === "input" || tag === "textarea" || t.isContentEditable === true;
}

// Simple hotkey hook; ignores events when typing in inputs/textarea/contentEditable
export function useHotkeys(map: HotkeyMap, deps: unknown[] = []) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isEditableTarget(e.target)) return;
      const key = normalizeKey(e);
      const fn = map[key] || map[e.key];
      if (fn) {
        fn(e);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, deps);
}

function normalizeKey(e: KeyboardEvent) {
  const parts: string[] = [];
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.metaKey) parts.push("Meta");
  if (e.shiftKey) parts.push("Shift");
  if (e.altKey) parts.push("Alt");
  parts.push(e.key);
  return parts.join("+");
}
