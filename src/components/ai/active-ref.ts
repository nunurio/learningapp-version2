"use client";
import * as React from "react";
import type { UUID } from "@/lib/types";

export type ActiveRef = {
  courseId?: UUID;
  lessonId?: UUID;
  cardId?: UUID;
  mode?: "workspace" | "learn";
};

const GLOBAL_KEY = "__aiActiveRef__";
const EVENT_NAME = "ai:active-ref-changed";

export function publishActiveRef(ref: ActiveRef) {
  try {
    (globalThis as Record<string, unknown>)[GLOBAL_KEY] = ref;
    const detail = ref;
    if (typeof globalThis.dispatchEvent === "function") {
      globalThis.dispatchEvent(new CustomEvent(EVENT_NAME, { detail }));
    }
  } catch {
    // no-op: publishing is best-effort only
  }
}

export function getActiveRef(): ActiveRef | undefined {
  try {
    return (globalThis as Record<string, unknown>)[GLOBAL_KEY] as ActiveRef | undefined;
  } catch {
    return undefined;
  }
}

export function useActiveRef() {
  const [ref, setRef] = React.useState<ActiveRef | undefined>(() => getActiveRef());
  React.useEffect(() => {
    const handler = (event: Event) => {
      const next = (event as CustomEvent<ActiveRef>).detail;
      setRef(next);
    };
    if (typeof globalThis.addEventListener === "function") {
      globalThis.addEventListener(EVENT_NAME, handler as EventListener);
    }
    return () => {
      if (typeof globalThis.removeEventListener === "function") {
        globalThis.removeEventListener(EVENT_NAME, handler as EventListener);
      }
    };
  }, []);
  return ref;
}
