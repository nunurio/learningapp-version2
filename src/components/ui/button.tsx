"use client";
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60 transform active:scale-95",
  {
    variants: {
      variant: {
        default: "bg-[hsl(var(--primary))] text-[hsl(var(--primary-fg))] shadow-md hover:shadow-lg hover:bg-[hsl(var(--primary-600))] hover:-translate-y-0.5",
        secondary:
          "bg-[hsl(var(--accent))] text-[hsl(var(--fg))] border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] shadow-sm hover:shadow-md",
        outline:
          [
            "bg-[hsl(var(--card))] text-[hsl(var(--fg))] border border-[hsl(var(--border))]",
            "hover:bg-[hsl(var(--accent))] hover:border-[hsl(var(--primary-300))] shadow-sm hover:shadow-md",
            // Disabled state visually clearer
            "disabled:bg-[hsl(var(--muted))] disabled:text-gray-400 disabled:border-gray-300 disabled:opacity-100 disabled:cursor-not-allowed disabled:shadow-none",
          ].join(" "),
        ghost: "bg-transparent text-[hsl(var(--fg))] hover:bg-[hsl(var(--accent))]",
        destructive:
          "bg-[hsla(0,84%,60%,.12)] text-[hsl(var(--destructive))] border border-[hsl(var(--destructive))]/40 hover:bg-[hsl(var(--destructive))] hover:text-white hover:border-[hsl(var(--destructive))]",
        gradient:
          "bg-gradient-to-r from-[hsl(var(--primary-500))] to-[hsl(var(--primary-400))] text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 hover:from-[hsl(var(--primary-600))] hover:to-[hsl(var(--primary-500))]",
        success:
          "bg-gradient-to-r from-[hsl(var(--success-500))] to-[hsl(var(--success-600))] text-white shadow-md hover:shadow-lg hover:-translate-y-0.5",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-base",
        xl: "h-14 px-8 text-lg",
      },
    },
    defaultVariants: {
      variant: "outline",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { buttonVariants };
