"use client";
import { useRef, useSyncExternalStore } from "react";
import type { UUID } from "@/lib/types";
import type { SaveCardDraftInput } from "@/lib/data";

// Lightweight external store for cross-pane realtime sync
// - Holds transient card drafts keyed by cardId
// - Tracks active pane for focus/UX ("nav" | "center" | "inspector")
// - Exposes a version counter to request refetch after server mutations

export type ActivePane = "nav" | "center" | "inspector";

type WorkspaceSnapshot = {
  drafts: Record<UUID, SaveCardDraftInput>;
  activePane: ActivePane;
  version: number;
  // Transient per-card understanding level (1-5) for realtime UI sync
  levels: Record<UUID, number | undefined>;
};

type Listener = () => void;

let state: WorkspaceSnapshot = {
  drafts: {},
  activePane: "center",
  version: 0,
  levels: {},
};

const listeners = new Set<Listener>();

function emit() {
  for (const l of Array.from(listeners)) l();
}

export const workspaceStore = {
  // subscription api for useSyncExternalStore
  subscribe(fn: Listener) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  getSnapshot(): WorkspaceSnapshot {
    return state;
  },
  // mutations
  setActivePane(pane: ActivePane) {
    if (state.activePane === pane) return;
    state = { ...state, activePane: pane };
    emit();
  },
  setDraft(input: SaveCardDraftInput) {
    const prev = state.drafts[input.cardId];
    // fast path: shallow compare by JSON stringify for small payloads
    const same = prev && JSON.stringify(prev) === JSON.stringify(input);
    if (same) return;
    state = { ...state, drafts: { ...state.drafts, [input.cardId]: input } };
    emit();
  },
  clearDraft(cardId: UUID) {
    if (!state.drafts[cardId]) return;
    const copy = { ...state.drafts };
    delete copy[cardId];
    state = { ...state, drafts: copy };
    emit();
  },
  // set transient understanding level for a card (1-5)
  setLevel(cardId: UUID, level: number | undefined) {
    // Normalize invalid values to undefined (removes override)
    const lv = typeof level === "number" && level > 0 ? Math.min(5, Math.max(1, Math.round(level))) : undefined;
    const prev = state.levels[cardId];
    if (prev === lv) return;
    // Avoid creating new object if no change
    const nextLevels = { ...state.levels } as Record<UUID, number | undefined>;
    if (lv == null) delete nextLevels[cardId]; else nextLevels[cardId] = lv;
    state = { ...state, levels: nextLevels };
    emit();
  },
  // bump version to signal consumers to refetch server snapshot
  bumpVersion() {
    state = { ...state, version: state.version + 1 };
    emit();
  },
};

export function useWorkspace(): WorkspaceSnapshot {
  return useSyncExternalStore(workspaceStore.subscribe, workspaceStore.getSnapshot);
}

export function useWorkspaceSelector<T>(selector: (s: WorkspaceSnapshot) => T, isEqual?: (a: T, b: T) => boolean): T {
  const snap = useSyncExternalStore(workspaceStore.subscribe, workspaceStore.getSnapshot);
  const val = selector(snap);
  const ref = useRef(val);
  const eq = isEqual ?? Object.is;
  if (!eq(ref.current, val)) ref.current = val;
  return ref.current;
}
