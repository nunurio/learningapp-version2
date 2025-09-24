"use client";
import * as React from "react";
import {
  PanelGroup as ResizablePanelGroupPrimitive,
  Panel as ResizablePanelPrimitive,
  PanelResizeHandle as ResizableHandlePrimitive,
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
        "relative flex items-center justify-center transition-all duration-200",
        // Horizontal orientation styles
        "data-[panel-group-direction=horizontal]:w-px data-[panel-group-direction=horizontal]:px-2",
        "data-[panel-group-direction=horizontal]:bg-gradient-to-b data-[panel-group-direction=horizontal]:from-transparent data-[panel-group-direction=horizontal]:via-[hsl(var(--border-default)_/_0.5)] data-[panel-group-direction=horizontal]:to-transparent",
        // Vertical orientation styles
        "data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:py-2 data-[panel-group-direction=vertical]:px-0",
        "data-[panel-group-direction=vertical]:bg-gradient-to-r data-[panel-group-direction=vertical]:from-transparent data-[panel-group-direction=vertical]:via-[hsl(var(--border-default)_/_0.5)] data-[panel-group-direction=vertical]:to-transparent",
        // Hover and active states
        "hover:data-[panel-group-direction=horizontal]:bg-gradient-to-b hover:data-[panel-group-direction=horizontal]:from-transparent hover:data-[panel-group-direction=horizontal]:via-[hsl(var(--primary-400)_/_0.3)] hover:data-[panel-group-direction=horizontal]:to-transparent",
        "hover:data-[panel-group-direction=vertical]:bg-gradient-to-r hover:data-[panel-group-direction=vertical]:from-transparent hover:data-[panel-group-direction=vertical]:via-[hsl(var(--primary-400)_/_0.3)] hover:data-[panel-group-direction=vertical]:to-transparent",
        "data-[resize-handle-active]:data-[panel-group-direction=horizontal]:bg-gradient-to-b data-[resize-handle-active]:data-[panel-group-direction=horizontal]:from-transparent data-[resize-handle-active]:data-[panel-group-direction=horizontal]:via-[hsl(var(--primary-500)_/_0.6)] data-[resize-handle-active]:data-[panel-group-direction=horizontal]:to-transparent",
        "data-[resize-handle-active]:data-[panel-group-direction=vertical]:bg-gradient-to-r data-[resize-handle-active]:data-[panel-group-direction=vertical]:from-transparent data-[resize-handle-active]:data-[panel-group-direction=vertical]:via-[hsl(var(--primary-500)_/_0.6)] data-[resize-handle-active]:data-[panel-group-direction=vertical]:to-transparent",
        // Glow effect on active
        "data-[resize-handle-active]:shadow-[0_0_10px_hsl(var(--primary-400)_/_0.3)]",
        // Focus styles
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-[hsl(var(--ring))]",
        className
      )}
      {...props}
    >
      {withHandle ? (
        <div aria-hidden className="z-10 flex h-5 w-3.5 items-center justify-center rounded-md bg-gradient-to-b from-[hsl(var(--muted))] to-[hsl(var(--muted)_/_0.8)] shadow-sm border border-[hsl(var(--border-default)_/_0.3)] backdrop-blur-sm hover:from-[hsl(var(--accent))] hover:to-[hsl(var(--accent)_/_0.9)] transition-colors duration-200">
          <div className="flex flex-col gap-0.5">
            <div className="h-0.5 w-2 rounded-full bg-[hsl(var(--muted-foreground)_/_0.5)]" />
            <div className="h-0.5 w-2 rounded-full bg-[hsl(var(--muted-foreground)_/_0.5)]" />
            <div className="h-0.5 w-2 rounded-full bg-[hsl(var(--muted-foreground)_/_0.5)]" />
          </div>
        </div>
      ) : null}
    </ResizableHandlePrimitive>
  );
}
