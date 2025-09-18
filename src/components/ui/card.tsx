import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "elevated" | "glass" | "gradient" | "interactive" | "bordered" | "glow";
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", ...props }, ref) => {
    const variantStyles = {
      default: "border border-[hsl(220_13%_85%)] bg-[hsl(var(--card))] shadow-[0_1px_3px_rgb(0_0_0_/_0.06),0_1px_2px_rgb(0_0_0_/_0.04)] hover:border-[hsl(220_13%_80%)] hover:shadow-md transition-all duration-200",
      elevated:
        [
          // base surface with softer border
          "relative isolate border border-[hsl(220_13%_90%)] bg-[hsl(var(--card))]",
          // enhanced depth shadow
          "shadow-[0_4px_12px_hsl(var(--primary-600)_/_0.08),0_0_0_1px_hsl(220_13%_85%)]",
          // hover depth with glow
          "hover:shadow-[0_8px_30px_hsl(var(--primary-600)_/_0.12),0_0_0_1px_hsl(var(--primary-300)_/_0.3)]",
          "hover:border-[hsl(var(--primary-300)_/_0.5)]",
          "hover:-translate-y-1",
          "transition-all duration-300 ease-out",
          // subtle inner highlight for crisp edge
          "before:content-[''] before:absolute before:inset-0 before:pointer-events-none before:shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] dark:before:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
        ].join(" "),
      glass: "bg-[hsl(var(--bg)_/_0.3)] backdrop-blur-xl border border-[hsl(var(--border)_/_0.3)] shadow-[0_8px_32px_hsl(0_0%_0%_/_0.08)] hover:bg-[hsl(var(--bg)_/_0.4)] hover:border-[hsl(var(--border)_/_0.4)] transition-all duration-300",
      gradient: "relative bg-gradient-to-br from-[hsl(var(--card))] to-[hsl(var(--accent))] border border-transparent bg-clip-padding before:absolute before:inset-0 before:-z-10 before:bg-gradient-to-br before:from-[hsl(var(--primary-400)_/_0.5)] before:to-[hsl(var(--secondary-400)_/_0.5)] before:rounded-xl before:content-[''] shadow-lg hover:shadow-xl transition-all duration-300",
      interactive: "border border-[hsl(220_13%_85%)] bg-[hsl(var(--card))] shadow-sm hover:shadow-[0_10px_25px_-3px_rgb(0_0_0_/_0.08),0_4px_10px_-4px_rgb(0_0_0_/_0.04)] hover:border-[hsl(var(--primary-300)_/_0.5)] hover:-translate-y-0.5 transition-all duration-200 cursor-pointer",
      bordered: "relative bg-[hsl(var(--card))] shadow-sm before:absolute before:inset-0 before:rounded-xl before:p-[1px] before:bg-gradient-to-br before:from-[hsl(var(--primary-400)_/_0.5)] before:to-[hsl(var(--secondary-400)_/_0.5)] before:-z-10 before:content-[''] hover:shadow-lg transition-all duration-300",
      glow: "border border-[hsl(220_13%_85%)] bg-[hsl(var(--card))] shadow-sm hover:border-[hsl(var(--primary-400)_/_0.5)] hover:shadow-[0_0_20px_hsl(var(--primary-400)_/_0.3)] transition-all duration-300",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-xl text-[hsl(var(--fg))] overflow-hidden",
          variantStyles[variant],
          className
        )}
        {...props}
      />
    );
  }
);
Card.displayName = "Card";

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6 bg-gradient-to-r from-transparent to-[hsl(var(--accent))]/5", className)} {...props} />
  )
);
CardHeader.displayName = "CardHeader";

export const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />
  )
);
CardTitle.displayName = "CardTitle";

export const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-[hsl(var(--fg))]/70 leading-relaxed", className)} {...props} />
  )
);
CardDescription.displayName = "CardDescription";

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  )
);
CardContent.displayName = "CardContent";

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  )
);
CardFooter.displayName = "CardFooter";
