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
};

type Listener = () => void;

let state: WorkspaceSnapshot = {
  drafts: {},
  activePane: "center",
  version: 0,
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
