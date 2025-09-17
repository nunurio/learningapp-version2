"use client";
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils/cn";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogPortal = DialogPrimitive.Portal;
export const DialogClose = DialogPrimitive.Close;

export const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/40 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { children?: React.ReactNode; "aria-label"?: string }
>(({ className, children, ...props }, ref) => {
  const containsDialogTitle = (node: React.ReactNode): boolean => {
    let found = false;
    React.Children.forEach(node as React.ReactNode, (child) => {
      if (found) return;
      if (!React.isValidElement(child)) return;
      const el = child as React.ReactElement<{ children?: React.ReactNode }>;
      if (el.type === DialogPrimitive.Title) {
        found = true;
        return;
      }
      if (el.props?.children) {
        if (containsDialogTitle(el.props.children)) found = true;
      }
    });
    return found;
  };
  const hasTitle = containsDialogTitle(children);
  const ariaLabel = props["aria-label"]; 
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          // Positioning
          "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
          // Sizing: responsive width + vertical limit with scroll
          "w-[95vw] sm:w-full max-w-lg max-h-[85vh] sm:max-h-[85dvh] overflow-y-auto overscroll-contain scrollbar-gutter-stable",
          // Aesthetics - Enhanced with modern effects
          "rounded-xl bg-popover text-popover-foreground p-6 outline-none",
          // Modern border with subtle gradient
          "border border-[hsl(220_13%_85%_/_0.8)]",
          // Enhanced shadow for depth
          "shadow-[0_20px_50px_-10px_hsl(0_0%_0%_/_0.25),0_10px_20px_-5px_hsl(0_0%_0%_/_0.1)]",
          // Subtle glow effect
          "ring-1 ring-white/10",
          // Animation and backdrop
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "data-[state=closed]:slide-out-to-bottom-[2%]",
          "data-[state=open]:slide-in-from-bottom-[2%]",
          // Dark mode enhancements
          "dark:border-[hsl(217_33%_25%_/_0.6)] dark:ring-white/5",
          "dark:shadow-[0_20px_50px_-10px_hsl(0_0%_0%_/_0.5),0_10px_20px_-5px_hsl(0_0%_0%_/_0.3)]",
          className
        )}
        {...props}
        aria-label={ariaLabel ?? (!hasTitle ? "Dialog" : undefined)}
      >
        {/* Body scroll lock while dialog is mounted */}
        {typeof window !== "undefined" ? (
          <ScrollLock />
        ) : null}
        {!hasTitle ? (
          <DialogPrimitive.Title className="sr-only">{ariaLabel ?? "Dialog"}</DialogPrimitive.Title>
        ) : null}
        {children}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

function ScrollLock() {
  React.useEffect(() => {
    const el = document.documentElement;
    const prev = el.style.overflow;
    el.style.overflow = "hidden";
    return () => {
      el.style.overflow = prev;
    };
  }, []);
  return null;
}

export const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
);
export const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
);
export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn("text-base font-semibold", className)} {...props} />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-sm text-gray-600", className)} {...props} />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;
