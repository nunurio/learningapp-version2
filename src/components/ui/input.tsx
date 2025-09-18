"use client";

import * as React from "react";

import { cn } from "@/lib/utils/cn";

type InputProps = React.ComponentPropsWithoutRef<"input">;

const Input = React.forwardRef<React.ElementRef<"input">, InputProps>(
  ({ className, type = "text", ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        data-slot="input"
        className={cn(
          "flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground shadow-xs transition-[color,box-shadow] duration-200 ease-in-out outline-none",
          "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground selection:bg-primary selection:text-primary-foreground",
          "border-[hsl(220_13%_85%)] bg-[hsl(var(--bg)_/_0.5)] hover:border-[hsl(220_13%_75%)] hover:bg-[hsl(var(--bg))]",
          "focus-visible:border-[hsl(var(--primary-400)_/_0.8)] focus-visible:bg-[hsl(var(--bg))] focus-visible:shadow-[0_0_0_3px_hsl(var(--primary-400)_/_0.1)] focus-visible:ring-[3px] focus-visible:ring-[hsl(var(--primary-400)_/_0.2)] focus-visible:ring-offset-0",
          "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
          "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[hsl(220_13%_85%)] md:text-sm",
          "dark:border-[hsl(217_33%_25%)] dark:bg-[hsl(var(--bg)_/_0.3)] dark:hover:border-[hsl(217_33%_35%)] dark:hover:bg-[hsl(var(--bg)_/_0.5)] dark:focus-visible:border-[hsl(var(--primary-400)_/_0.6)] dark:focus-visible:ring-[hsl(var(--primary-400)_/_0.15)] dark:focus-visible:shadow-[0_0_0_3px_hsl(var(--primary-400)_/_0.08)]",
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";

export { Input };
export type { InputProps };
