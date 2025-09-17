"use client"

import * as React from "react"
import * as SeparatorPrimitive from "@radix-ui/react-separator"

import { cn } from "@/lib/utils/cn"

interface SeparatorProps extends React.ComponentProps<typeof SeparatorPrimitive.Root> {
  variant?: "default" | "soft" | "gradient" | "glow" | "strong"
}

function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  variant = "default",
  ...props
}: SeparatorProps) {
  const variantStyles = {
    default: orientation === "horizontal"
      ? "bg-[hsl(var(--border-default)_/_0.6)]"
      : "bg-[hsl(var(--border-default)_/_0.6)]",
    soft: orientation === "horizontal"
      ? "bg-gradient-to-r from-transparent via-[hsl(var(--border-default)_/_0.5)] to-transparent"
      : "bg-gradient-to-b from-transparent via-[hsl(var(--border-default)_/_0.5)] to-transparent",
    gradient: orientation === "horizontal"
      ? "bg-gradient-to-r from-[hsl(var(--primary-400)_/_0.3)] via-[hsl(var(--secondary-400)_/_0.3)] to-[hsl(var(--primary-400)_/_0.3)]"
      : "bg-gradient-to-b from-[hsl(var(--primary-400)_/_0.3)] via-[hsl(var(--secondary-400)_/_0.3)] to-[hsl(var(--primary-400)_/_0.3)]",
    glow: orientation === "horizontal"
      ? "bg-[hsl(var(--border-default))] hover:bg-[hsl(var(--primary-400)_/_0.5)] hover:shadow-[0_0_10px_hsl(var(--primary-400)_/_0.3)] transition-all duration-200"
      : "bg-[hsl(var(--border-default))] hover:bg-[hsl(var(--primary-400)_/_0.5)] hover:shadow-[0_0_10px_hsl(var(--primary-400)_/_0.3)] transition-all duration-200",
    strong: orientation === "horizontal"
      ? "bg-[hsl(var(--border-strong))] shadow-[0_1px_2px_hsl(0_0%_0%_/_0.05)]"
      : "bg-[hsl(var(--border-strong))] shadow-[1px_0_2px_hsl(0_0%_0%_/_0.05)]",
  }

  return (
    <SeparatorPrimitive.Root
      data-slot="separator"
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "shrink-0",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        variantStyles[variant],
        className
      )}
      {...props}
    />
  )
}

export { Separator }
