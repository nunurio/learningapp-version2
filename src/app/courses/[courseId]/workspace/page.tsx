import type { Metadata } from "next";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";

export const metadata: Metadata = {
  title: "Workspace | Learnify",
};

export default async function Page({ params }: { params: Promise<{ courseId: string }> }) {
  // Next.js 15: params は非同期
  const { courseId } = await params;
  const key = `learnify-ws-${courseId}`;
  return <WorkspaceShell courseId={courseId} cookieKey={key} />;
}
