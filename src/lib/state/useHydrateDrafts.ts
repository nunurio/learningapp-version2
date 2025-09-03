"use client";
import * as React from "react";
import { draftsAll } from "@/lib/idb";
import type { SaveCardDraftInput } from "@/lib/data";
import { workspaceStore } from "@/lib/state/workspace-store";

let hydrated = false;

export function useHydrateDraftsOnce() {
  React.useEffect(() => {
    if (hydrated) return;
    hydrated = true;
    (async () => {
      try {
        const rows = await draftsAll();
        for (const r of rows) workspaceStore.setDraft(r.data as SaveCardDraftInput);
      } catch {
        // ignore
      }
    })();
  }, []);
}
