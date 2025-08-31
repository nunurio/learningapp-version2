"use client";
import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getToastHistory, subscribeToastHistory } from "@/components/ui/toaster";

export function NotificationCenterButton() {
  const [open, setOpen] = React.useState(false);
  const [count, setCount] = React.useState(getToastHistory().length);
  React.useEffect(() => subscribeToastHistory(() => setCount(getToastHistory().length)), []);
  return (
    <>
      <Button onClick={() => setOpen(true)} aria-label="通知センター" variant="ghost">🔔 {count > 0 ? count : ""}</Button>
      {/* SR向けライブリージョンでカウント変化を告知 */}
      <span className="sr-only" aria-live="polite">
        {count > 0 ? `新しい通知が${count}件あります` : "通知はありません"}
      </span>
      <NotificationCenter open={open} onOpenChange={setOpen} />
    </>
  );
}

export function NotificationCenter({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [items, setItems] = React.useState(getToastHistory());
  React.useEffect(() => subscribeToastHistory(() => setItems(getToastHistory())), []);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-label="通知センター">
        <DialogHeader>
          <DialogTitle>通知センター</DialogTitle>
        </DialogHeader>
        {items.length === 0 ? (
          <p className="text-sm text-gray-600">通知はありません。</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {items.map((t) => (
              <li key={t.id} className="border-b border-[hsl(var(--border))] pb-2">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{t.title ?? "通知"}</div>
                  <div className="text-[10px] text-gray-500">{new Date(t.createdAt).toLocaleString()}</div>
                </div>
                {t.description && <div className="text-gray-700">{t.description}</div>}
                <div className="mt-1 text-[10px] text-gray-500">状態: {t.state}</div>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
