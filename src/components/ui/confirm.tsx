"use client";
import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type ConfirmProps = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  children?: React.ReactNode; // optional trigger (asChild)
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function Confirm({
  title,
  description,
  confirmLabel = "OK",
  cancelLabel = "キャンセル",
  onConfirm,
  children,
  open: openProp,
  onOpenChange,
}: ConfirmProps) {
  const isControlled = typeof openProp === "boolean";
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = isControlled ? (openProp as boolean) : internalOpen;
  const setOpen = isControlled ? (onOpenChange ?? (() => {})) : setInternalOpen;
  const [loading, setLoading] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children ? <DialogTrigger asChild>{children}</DialogTrigger> : null}
      <DialogContent aria-label={title}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <DialogFooter>
          <Button onClick={() => setOpen(false)} disabled={loading}>{cancelLabel}</Button>
          <Button
            onClick={async () => {
              try {
                setLoading(true);
                await onConfirm();
              } finally {
                setLoading(false);
                setOpen(false);
              }
            }}
            variant="destructive"
            disabled={loading}
            aria-busy={loading}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
