import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils/cn"

const buttonVariants = cva(
<<<<<<< HEAD
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 ease-out disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none relative active:scale-[0.97] ring-offset-background overflow-hidden focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[hsl(var(--primary-400)_/_0.35)]",
=======
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
>>>>>>> 0a833ad (feat: Radix UIのアラートダイアログコンポーネントを追加し、エディタツールバーの保存機能を改善)
  {
    variants: {
      variant: {
        default:
<<<<<<< HEAD
          "bg-gradient-to-b from-primary-600 to-primary-700 text-white shadow-[0_1px_3px_rgb(0_0_0_/_0.12),0_1px_2px_rgb(0_0_0_/_0.06)] hover:from-primary-700 hover:to-primary-800 hover:shadow-[0_4px_8px_hsl(var(--primary-600)_/_0.25)] active:shadow-sm before:absolute before:inset-0 before:bg-gradient-to-b before:from-white/10 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:content-[''] dark:from-primary-500 dark:to-primary-600 dark:hover:from-primary-400 dark:hover:to-primary-500",
        destructive:
          "bg-gradient-to-b from-destructive to-destructive/90 text-white shadow-[0_1px_3px_rgb(0_0_0_/_0.12),0_1px_2px_rgb(0_0_0_/_0.06)] hover:from-destructive/90 hover:to-destructive/80 hover:shadow-[0_4px_8px_hsl(var(--destructive)_/_0.25)] active:shadow-sm focus-visible:ring-destructive/40 dark:from-destructive/60 dark:to-destructive/70",
        outline:
          "border border-[hsl(220_13%_85%)] bg-background/95 backdrop-blur-sm hover:bg-accent hover:text-accent-foreground hover:border-[hsl(var(--primary-300)_/_0.5)] shadow-sm hover:shadow-[0_4px_12px_hsl(var(--primary-600)_/_0.15)] active:shadow-sm focus-visible:ring-primary-500 dark:border-[hsl(217_33%_25%)] dark:hover:bg-accent/50 dark:hover:border-[hsl(var(--primary-400)_/_0.4)]",
        secondary:
          "bg-gradient-to-b from-secondary-500 to-secondary-600 text-white shadow-[0_1px_3px_rgb(0_0_0_/_0.12),0_1px_2px_rgb(0_0_0_/_0.06)] hover:from-secondary-600 hover:to-secondary-700 hover:shadow-[0_4px_8px_hsl(var(--secondary-500)_/_0.25)] active:shadow-sm focus-visible:ring-secondary-500",
        ghost:
          "hover:bg-accent/80 hover:text-accent-foreground hover:shadow-sm active:bg-accent dark:hover:bg-accent/30 transition-colors",
        link: "text-primary underline-offset-4 hover:underline hover:text-primary-700 dark:hover:text-primary-300 transition-colors",
=======
          "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        destructive:
          "bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
>>>>>>> 0a833ad (feat: Radix UIのアラートダイアログコンポーネントを追加し、エディタツールバーの保存機能を改善)
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
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
