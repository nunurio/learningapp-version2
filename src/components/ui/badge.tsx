import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "bg-[hsl(var(--accent))] text-[hsl(var(--fg))] border-[hsl(var(--border))]",
        secondary: "bg-transparent text-[hsl(var(--fg))] border-[hsl(var(--border))]",
        destructive: "bg-[hsla(0,84%,60%,.10)] text-[hsl(var(--destructive))] border-[hsl(var(--destructive))]/40",
        add: "bg-[hsl(142,76%,97%)] text-[hsl(142,72%,29%)] border-[hsl(142,46%,58%)]/40",
        update: "bg-[hsl(221,83%,96%)] text-[hsl(221,83%,45%)] border-[hsl(221,83%,65%)]/40",
        statusDraft: "bg-[hsl(48,100%,96%)] text-[hsl(38,92%,50%)] border-[hsl(38,92%,60%)]/50",
        statusPublished: "bg-[hsl(147,78%,96%)] text-[hsl(152,63%,40%)] border-[hsl(152,63%,55%)]/40",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
