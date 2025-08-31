"use client";
import * as React from "react";
import {
  PanelGroup as ResizablePanelGroupPrimitive,
  Panel as ResizablePanelPrimitive,
  PanelResizeHandle as ResizableHandlePrimitive,
  type ImperativePanelGroupHandle,
} from "react-resizable-panels";
import { cn } from "@/lib/utils/cn";

type GroupProps = React.ComponentProps<typeof ResizablePanelGroupPrimitive> & {
  className?: string;
};
type PanelProps = React.ComponentProps<typeof ResizablePanelPrimitive> & {
  className?: string;
};
type HandleProps = React.ComponentProps<typeof ResizableHandlePrimitive> & {
  withHandle?: boolean;
};

export function ResizablePanelGroup({ className, ...props }: GroupProps) {
  return (
    <ResizablePanelGroupPrimitive
      className={cn(
        "flex h-full w-full data-[panel-group-direction=vertical]:flex-col",
        className
      )}
      {...props}
    />
  );
}

export function ResizablePanel({ className, ...props }: PanelProps) {
  return (
    <ResizablePanelPrimitive
      className={cn("h-full overflow-auto", className)}
      {...props}
    />
  );
}

export function ResizableHandle({ withHandle, className, ...props }: HandleProps) {
  return (
    <ResizableHandlePrimitive
      className={cn(
        "relative flex w-px items-center justify-center bg-[hsl(var(--border))] transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[hsl(var(--ring))] data-[resize-handle-active]:bg-[hsl(var(--primary))] data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:py-2 data-[panel-group-direction=vertical]:px-0 data-[panel-group-direction=horizontal]:px-2",
        className
      )}
      {...props}
    >
      {withHandle ? (
        <div aria-hidden className="z-10 flex h-4 w-3 items-center justify-center rounded-sm bg-[hsl(var(--muted))]">
          <div className="h-3 w-0.5 rounded bg-[hsl(var(--muted-foreground))]" />
        </div>
      ) : null}
    </ResizableHandlePrimitive>
  );
}
