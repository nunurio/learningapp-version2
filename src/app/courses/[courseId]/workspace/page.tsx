import type { Metadata } from "next";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";

export const metadata: Metadata = {
  title: "Workspace | Learnify",
};

export default function Page({ params }: { params: { courseId: string } }) {
  // パネルのレイアウトは client 側の PanelGroup.autoSaveId に委譲する。
  const key = `learnify-ws-${params.courseId}`;
  return <WorkspaceShell courseId={params.courseId} cookieKey={key} />;
}
