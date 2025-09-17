import * as React from "react";
import { cn } from "@/lib/utils/cn";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground",
          // Modern border with subtle color
          "border border-[hsl(220_13%_85%)] bg-[hsl(var(--bg)_/_0.5)]",
          // Enhanced focus state with glow effect
          "transition-all duration-200 ease-in-out",
          "hover:border-[hsl(220_13%_75%)] hover:bg-[hsl(var(--bg))]",
          "focus:outline-none focus:border-[hsl(var(--primary-400)_/_0.8)]",
          "focus:ring-2 focus:ring-[hsl(var(--primary-400)_/_0.2)] focus:ring-offset-0",
          "focus:shadow-[0_0_0_3px_hsl(var(--primary-400)_/_0.1)]",
          "focus:bg-[hsl(var(--bg))]",
          // Disabled state
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[hsl(220_13%_85%)]",
          // Dark mode adjustments
          "dark:border-[hsl(217_33%_25%)] dark:bg-[hsl(var(--bg)_/_0.3)]",
          "dark:hover:border-[hsl(217_33%_35%)] dark:hover:bg-[hsl(var(--bg)_/_0.5)]",
          "dark:focus:border-[hsl(var(--primary-400)_/_0.6)]",
          "dark:focus:ring-[hsl(var(--primary-400)_/_0.15)]",
          "dark:focus:shadow-[0_0_0_3px_hsl(var(--primary-400)_/_0.08)]",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
