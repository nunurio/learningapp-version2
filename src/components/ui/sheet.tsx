"use client";
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils/cn";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

export function SheetContent({
  className,
  side = "right",
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { side?: "left" | "right" }) {
  // Ensure Dialog.Content always has an accessible name.
  // Radix logs a console error if there is neither a Dialog.Title descendant
  // nor an explicit `aria-label` on Content. We add a visually hidden title
  // as a safe fallback when neither is present.
  const ariaLabel = (props as any)["aria-label"] as string | undefined;

  const containsDialogTitle = (node: React.ReactNode): boolean => {
    let found = false;
    React.Children.forEach(node as React.ReactNode, (child) => {
      if (found) return;
      if (!React.isValidElement(child)) return;
      // Direct Title
      if (child.type === (DialogPrimitive as any).Title) {
        found = true;
        return;
      }
      // Recurse into children (e.g., inside SheetHeader)
      if (child.props?.children) {
        if (containsDialogTitle(child.props.children)) found = true;
      }
    });
    return found;
  };

  const hasTitle = containsDialogTitle(children);

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/30" />
      <DialogPrimitive.Content
        className={cn(
          "fixed z-50 h-full w-full sm:w-80 bg-[hsl(var(--card))] border-[hsl(var(--border))] border-l p-4 shadow-xl",
          side === "right" ? "inset-y-0 right-0" : "inset-y-0 left-0 border-l-0 border-r",
          className
        )}
        {...props}
      >
        {!hasTitle ? (
          <DialogPrimitive.Title className="sr-only">{ariaLabel ?? "パネル"}</DialogPrimitive.Title>
        ) : null}
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-3 flex items-center justify-between", className)} {...props} />;
}
