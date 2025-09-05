import type { Metadata } from "next";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";

export const metadata: Metadata = {
  title: "Workspace | Learnify",
};

export default async function Page({ params, searchParams }: { params: Promise<{ courseId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // Next.js 15: params/searchParams は非同期
  const { courseId } = await params;
  const sp = await searchParams;
  const cardId = (typeof sp.cardId === "string" ? sp.cardId : Array.isArray(sp.cardId) ? sp.cardId[0] : undefined) as string | undefined;
  const key = `learnify-ws-${courseId}`;
  return <WorkspaceShell courseId={courseId} cookieKey={key} initialCardId={cardId} />;
}
