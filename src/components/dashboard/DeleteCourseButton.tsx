"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Confirm } from "@/components/ui/confirm";
import { deleteCourse } from "@/lib/client-api";
import { Trash2 } from "lucide-react";

export function DeleteCourseButton({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Confirm
      title="このコースを削除しますか？"
      description="この操作は元に戻せません。関連するレッスンとカードも削除されます。"
      confirmLabel={pending ? "削除中…" : "削除する"}
      cancelLabel="キャンセル"
      onConfirm={() =>
        start(async () => {
          await deleteCourse(courseId);
          router.refresh();
        })
      }
    >
      <Button variant="ghost" size="sm" aria-label="削除" title="削除" disabled={pending}>
        <Trash2 className="h-4 w-4" aria-hidden />
      </Button>
    </Confirm>
  );
}

export default DeleteCourseButton;

