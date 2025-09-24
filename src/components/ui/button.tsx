"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 ease-out disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none relative overflow-hidden active:scale-[0.97] ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[hsl(var(--primary-400)_/_0.35)] aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-b from-primary-600 to-primary-700 text-white shadow-[0_1px_3px_rgb(0_0_0_/_0.12),0_1px_2px_rgb(0_0_0_/_0.06)] hover:from-primary-700 hover:to-primary-800 hover:shadow-[0_4px_8px_hsl(var(--primary-600)_/_0.25)] active:shadow-sm before:absolute before:inset-0 before:bg-gradient-to-b before:from-white/10 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:content-[''] dark:from-primary-500 dark:to-primary-600 dark:hover:from-primary-400 dark:hover:to-primary-500",
        destructive:
          "bg-gradient-to-b from-destructive to-destructive/90 text-white shadow-[0_1px_3px_rgb(0_0_0_/_0.12),0_1px_2px_rgb(0_0_0_/_0.06)] hover:from-destructive/90 hover:to-destructive/80 hover:shadow-[0_4px_8px_hsl(var(--destructive)_/_0.25)] active:shadow-sm focus-visible:ring-destructive/40 dark:from-destructive/60 dark:to-destructive/70",
        outline:
          "border border-[hsl(220_13%_85%)] bg-background/95 backdrop-blur-sm hover:bg-accent hover:text-accent-foreground hover:border-[hsl(var(--primary-300)_/_0.5)] shadow-sm hover:shadow-[0_4px_12px_hsl(var(--primary-600)_/_0.15)] active:shadow-sm focus-visible:ring-primary-500 dark:border-[hsl(217_33%_25%)] dark:hover:bg-accent/50 dark:hover:border-[hsl(var(--primary-400)_/_0.4)]",
        secondary:
          "bg-gradient-to-b from-secondary-500 to-secondary-600 text-white shadow-[0_1px_3px_rgb(0_0_0_/_0.12),0_1px_2px_rgb(0_0_0_/_0.06)] hover:from-secondary-600 hover:to-secondary-700 hover:shadow-[0_4px_8px_hsl(var(--secondary-500)_/_0.25)] active:shadow-sm focus-visible:ring-secondary-500",
        ghost:
          "hover:bg-accent/80 hover:text-accent-foreground hover:shadow-sm active:bg-accent transition-colors dark:hover:bg-accent/30",
        link:
          "text-primary underline-offset-4 hover:underline hover:text-primary-700 transition-colors dark:hover:text-primary-300",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

const Button = React.forwardRef<
  React.ElementRef<"button">,
  React.ComponentPropsWithoutRef<"button"> &
    VariantProps<typeof buttonVariants> & {
      asChild?: boolean
    }
>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      ref={ref}
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
});

Button.displayName = "Button";

export { Button, buttonVariants };
