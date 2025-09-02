"use client";
import * as React from "react";

function Bar({ w }: { w: string }) {
  return <div className="h-3 rounded bg-[hsl(var(--border))]" style={{ width: w }} />;
}

export function SkeletonNavTree() {
  return (
    <div className="h-full flex flex-col animate-pulse">
      <div className="p-2 border-b grid gap-2">
        <Bar w="100%" />
        <div className="flex items-center gap-2">
          <Bar w="60px" />
          <Bar w="100px" />
        </div>
      </div>
      <div className="p-2 space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Bar w="12px" />
            <Bar w={`${60 + (i % 3) * 10}%`} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonInspector() {
  return (
    <div className="h-full p-3 animate-pulse space-y-3">
      <Bar w="40%" />
      <Bar w="100%" />
      <Bar w="80%" />
      <Bar w="100%" />
    </div>
  );
}

export function SkeletonPlayer() {
  return (
    <div className="p-4 animate-pulse space-y-3">
      <Bar w="30%" />
      <Bar w="90%" />
      <Bar w="85%" />
      <Bar w="70%" />
    </div>
  );
}

