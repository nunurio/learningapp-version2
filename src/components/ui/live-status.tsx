"use client";
import * as React from "react";

// Screen-reader friendly live region for transient status updates
export function LiveStatus({ message, assertive = false }: { message: string; assertive?: boolean }) {
  return (
    <div role={assertive ? "alert" : "status"} aria-live={assertive ? "assertive" : "polite"} className="sr-only">
      {message}
    </div>
  );
}

