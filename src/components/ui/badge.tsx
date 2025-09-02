import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all duration-200 shadow-sm",
  {
    variants: {
      variant: {
        default: "bg-[hsl(var(--accent))] text-[hsl(var(--fg))] border-[hsl(var(--border))] hover:shadow-md",
        secondary: "bg-transparent text-[hsl(var(--fg))] border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))]",
        destructive: "bg-gradient-to-r from-red-50 to-pink-50 text-[hsl(var(--destructive))] border-[hsl(var(--destructive))]/40 hover:from-red-100 hover:to-pink-100",
        add: "bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 border-green-300 hover:from-green-100 hover:to-emerald-100",
        update: "bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border-blue-300 hover:from-blue-100 hover:to-indigo-100",
        statusDraft: "bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-700 border-amber-300 hover:from-amber-100 hover:to-yellow-100",
        statusPublished: "bg-gradient-to-r from-teal-50 to-green-50 text-teal-700 border-teal-300 hover:from-teal-100 hover:to-green-100",
        primary: "bg-gradient-to-r from-[hsl(var(--primary-100))] to-[hsl(var(--primary-200))] text-[hsl(var(--primary-700))] border-[hsl(var(--primary-300))]",
        success: "bg-gradient-to-r from-[hsl(var(--success-50))] to-green-50 text-[hsl(var(--success-600))] border-[hsl(var(--success-500))]/30",
        warning: "bg-gradient-to-r from-[hsl(var(--warning-50))] to-orange-50 text-[hsl(var(--warning-600))] border-[hsl(var(--warning-500))]/30",
      },
      size: {
        sm: "px-2 py-0.5 text-xs",
        md: "px-2.5 py-0.5 text-xs",
        lg: "px-3 py-1 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}
