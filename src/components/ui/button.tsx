"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-150 ease-out disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none relative active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring ring-offset-background",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-white shadow-sm hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-400 hover:shadow-md active:shadow-sm",
        destructive:
          "bg-destructive text-white shadow-sm hover:bg-destructive/90 dark:bg-destructive/60 dark:hover:bg-destructive/50 focus-visible:ring-destructive/40 hover:shadow-md active:shadow-sm",
        outline:
          "border border-border bg-background hover:bg-accent hover:text-accent-foreground dark:border-border/40 dark:hover:bg-accent/50 shadow-sm hover:shadow-md active:shadow-sm",
        secondary:
          "bg-secondary text-white shadow-sm hover:bg-secondary-600 dark:bg-secondary-500 dark:hover:bg-secondary-400 hover:shadow-md active:shadow-sm",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/30",
        link: "text-primary underline-offset-4 hover:underline hover:text-primary-700 dark:hover:text-primary-300",
      },
      size: {
        default: "h-10 px-4 py-2 has-[>svg]:px-3",
        sm: "h-9 rounded-md px-3 text-xs has-[>svg]:px-2.5",
        lg: "h-11 rounded-md px-8 text-base has-[>svg]:px-6",
        icon: "size-10 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        data-slot="button"
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
