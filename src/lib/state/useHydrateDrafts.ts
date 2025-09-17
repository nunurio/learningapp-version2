"use client";
import * as React from "react";

let hydrated = false;

export function useHydrateDraftsOnce() {
  React.useEffect(() => {
    if (hydrated) return;
    hydrated = true;
  }, []);
}
