import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "elevated" | "glass" | "gradient" | "interactive";
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", ...props }, ref) => {
    const variantStyles = {
      default: "border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-sm",
      elevated:
        [
          // base surface
          "relative isolate border border-[hsl(var(--border))] bg-[hsl(var(--card))]",
          // soft depth shadow (matches dashboard screenshot tone)
          "shadow-[0_16px_40px_-20px_hsl(0_0%_0%/0.25),0_6px_18px_-8px_hsl(0_0%_0%/0.12)]",
          // hover depth
          "hover:shadow-[0_24px_60px_-24px_hsl(0_0%_0%/0.35),0_10px_24px_-10px_hsl(0_0%_0%/0.18)]",
          "transition-shadow duration-300",
          // subtle inner highlight for crisp edge
          "before:content-[''] before:absolute before:inset-0 before:pointer-events-none before:shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] dark:before:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
        ].join(" "),
      glass: "bg-white/10 backdrop-blur-md border border-white/20 shadow-xl",
      gradient: "bg-gradient-to-br from-[hsl(var(--card))] to-[hsl(var(--accent))] border border-[hsl(var(--border))]/50 shadow-md",
      interactive: "border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer",
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
