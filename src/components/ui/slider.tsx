"use client"

import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils/cn"

type SliderProps = React.ComponentProps<typeof SliderPrimitive.Root> & {
  color?: string; // Range背景/Thumb枠のカラー（CSSカラー文字列）
};

function Slider({
  className,
  defaultValue,
  value,
  color,
  ...props
}: SliderProps) {
  // Render thumbs based on provided value/defaultValue; fallback to 1 thumb.
  const thumbsCount = React.useMemo(
    () => (Array.isArray(value)
      ? value.length
      : Array.isArray(defaultValue)
        ? defaultValue.length
        : 1),
    [value, defaultValue]
  );

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      className={cn(
        "relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col",
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className={cn(
          "relative grow overflow-hidden rounded-full data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5 bg-[hsl(var(--muted))]"
        )}
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className={cn(
            "absolute data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full bg-[hsl(var(--primary))]"
          )}
          style={color ? { backgroundColor: color } : undefined}
        />
      </SliderPrimitive.Track>
      {Array.from({ length: thumbsCount }, (_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          className="block size-4 shrink-0 rounded-full border shadow-sm transition-[color,box-shadow] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50 bg-background border-primary focus-visible:ring-ring hover:ring-ring"
          style={color ? { borderColor: color } : undefined}
        />
      ))}
    </SliderPrimitive.Root>
  )
}

export { Slider }
