"use client"

import * as React from "react"
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area"

import { cn } from "@/lib/utils/cn"

type ScrollAreaViewportElement = React.ElementRef<typeof ScrollAreaPrimitive.Viewport>
type ScrollAreaViewportProps = React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Viewport> & {
  ref?: React.Ref<ScrollAreaViewportElement>
}

type ScrollAreaProps = React.ComponentProps<typeof ScrollAreaPrimitive.Root> & {
  className?: string
  viewportClassName?: string
  viewportProps?: ScrollAreaViewportProps
}

function ScrollArea({
  className,
  viewportClassName,
  viewportProps,
  children,
  ...props
}: ScrollAreaProps) {
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn("relative", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        data-slot="scroll-area-viewport"
        {...viewportProps}
        className={cn(
          "focus-visible:ring-ring/50 size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:outline-1",
          viewportClassName,
          viewportProps?.className,
        )}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  )
}

function ScrollBar({
  className,
  orientation = "vertical",
  forceMount = true,
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      forceMount={forceMount}
      className={cn(
        "flex touch-none p-px transition-colors select-none z-10",
        // Position to overlay inside root
        orientation === "vertical" && "absolute right-0 top-0",
        orientation === "horizontal" && "absolute left-0 bottom-0",
        orientation === "vertical" &&
          "h-full w-2.5 border-l border-l-transparent",
        orientation === "horizontal" &&
          "h-2.5 flex-col border-t border-t-transparent",
        className
      )}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb
        data-slot="scroll-area-thumb"
        className="bg-border relative flex-1 rounded-full"
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  )
}

export { ScrollArea, ScrollBar }
