"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import type { UUID } from "@/lib/types";
import { Header } from "@/components/ui/header";
import { Button } from "@/components/ui/button";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import dynamic from "next/dynamic";
import { SkeletonNavTree, SkeletonInspector, SkeletonPlayer } from "@/components/workspace/Skeletons";
const NavTree = dynamic(() => import("@/components/workspace/NavTree").then((m) => m.NavTree), { ssr: false, loading: () => <SkeletonNavTree /> });
const Inspector = dynamic(() => import("@/components/workspace/Inspector").then((m) => m.Inspector), { ssr: false, loading: () => <SkeletonInspector /> });
const CardPlayer = dynamic(() => import("@/components/workspace/CardPlayer").then((m) => m.CardPlayer), { ssr: false, loading: () => <SkeletonPlayer /> });
import { Sheet, SheetContent, SheetHeader, SheetTrigger } from "@/components/ui/sheet";
import { listCards as listCardsApi } from "@/lib/client-api";

type Props = { courseId: UUID; defaultLayout?: number[]; cookieKey?: string };

export function WorkspaceShell({ courseId, defaultLayout, cookieKey }: Props) {
  const router = useRouter();
  const [selId, setSelId] = React.useState<string | undefined>(undefined);
  const [selKind, setSelKind] = React.useState<"lesson" | "card" | undefined>(undefined);
  const [openNav, setOpenNav] = React.useState(false);
  const [openInspector, setOpenInspector] = React.useState(false);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="h-[calc(100vh-56px)]">
        <div className="hidden md:block h-full">
          <ResizablePanelGroup
            direction="horizontal"
            autoSaveId={`workspace:${courseId}`}
            onLayout={(sizes) => {
              if (cookieKey) document.cookie = `${cookieKey}=${JSON.stringify(sizes)}; path=/; max-age=${60 * 60 * 24 * 365}`;
            }}
          >
            <ResizablePanel defaultSize={defaultLayout?.[0] ?? 24} minSize={16} className="border-r">
              <NavTree
                courseId={courseId}
                selectedId={selId}
                onSelect={(id, kind) => {
                  if (kind === "course") {
                    if (id !== courseId) {
                      router.push(`/courses/${id}/workspace`);
                    } else {
                      setSelId(undefined);
                      setSelKind(undefined);
                    }
                    return;
                  }
                  if (kind === "lesson-edit") {
                    setSelId(id);
                    setSelKind("lesson");
                    return;
                  }
                  if (kind === "lesson") {
                    (async () => {
                      const first = (await listCardsApi(id))[0];
                      if (first) { setSelId(first.id); setSelKind("card"); }
                      else { setSelId(undefined); setSelKind(undefined); }
                    })();
                  } else {
                    setSelId(id);
                    setSelKind("card");
                  }
                }}
              />
            </ResizablePanel>
            <ResizableHandle withHandle aria-label="ナビをリサイズ" />
            <ResizablePanel defaultSize={defaultLayout?.[1] ?? 48} minSize={40} className="">
              <CenterPanel
                courseId={courseId}
                selId={selId}
                selKind={selKind}
                onNavigate={(id) => { setSelId(id); setSelKind("card"); }}
              />
            </ResizablePanel>
            <ResizableHandle withHandle aria-label="エディタをリサイズ" />
            <ResizablePanel defaultSize={defaultLayout?.[2] ?? 28} minSize={18} className="border-l">
              <Inspector courseId={courseId} selectedId={selId} selectedKind={selKind} />
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>

        <div className="md:hidden h-full">
          <div className="px-3 py-2 border-b flex items-center justify-between">
            <div className="font-medium">学習ワークスペース</div>
            <div className="flex items-center gap-2">
              <Sheet open={openNav} onOpenChange={setOpenNav}>
                <SheetTrigger asChild>
                  <Button aria-label="メニュー" size="sm">メニュー</Button>
                </SheetTrigger>
                <SheetContent side="left" aria-label="ナビ">
                  <SheetHeader>
                    <div className="font-medium">コース構造</div>
                    <Button onClick={() => setOpenNav(false)} size="sm" variant="outline">閉じる</Button>
                  </SheetHeader>
                  <div className="h-[calc(100vh-120px)] overflow-auto">
                    <NavTree
                      courseId={courseId}
                      selectedId={selId}
                      onSelect={(id, kind) => {
                        if (kind === "course") {
                          setOpenNav(false);
                          if (id !== courseId) router.push(`/courses/${id}/workspace`);
                          else { setSelId(undefined); setSelKind(undefined); }
                          return;
                        }
                        if (kind === "lesson-edit") {
                          setSelId(id);
                          setSelKind("lesson");
                          setOpenNav(false);
                          setOpenInspector(true);
                          return;
                        }
                        if (kind === "lesson") {
                          (async () => {
                            const first = (await listCardsApi(id))[0];
                            if (first) { setSelId(first.id); setSelKind("card"); }
                            else { setSelId(undefined); setSelKind(undefined); }
                          })();
                        } else {
                          setSelId(id);
                          setSelKind("card");
                        }
                        setOpenNav(false);
                      }}
                    />
                  </div>
                </SheetContent>
              </Sheet>
              <Sheet open={openInspector} onOpenChange={setOpenInspector}>
                <SheetTrigger asChild>
                  <Button aria-label="編集" size="sm">編集</Button>
                </SheetTrigger>
                <SheetContent side="right" aria-label="編集">
                  <SheetHeader>
                    <div className="font-medium">インスペクタ</div>
                    <Button onClick={() => setOpenInspector(false)} size="sm" variant="outline">閉じる</Button>
                  </SheetHeader>
                  <div className="h-[calc(100vh-120px)] overflow-auto">
                    <Inspector courseId={courseId} selectedId={selId} selectedKind={selKind} />
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
          <div className="h-[calc(100vh-98px)] overflow-auto p-3">
            {!selId ? (
              <p className="text-sm text-gray-700">メニューからカードを選択してください。</p>
            ) : (
              <CardPlayer
                courseId={courseId}
                selectedId={selId}
                selectedKind={selKind}
                onNavigate={(id) => { setSelId(id); setSelKind("card"); }}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function CenterPanel({ courseId, selId, selKind, onNavigate }: { courseId: UUID; selId?: string; selKind?: "lesson"|"card"; onNavigate: (id: UUID) => void }) {
  return (
    <div className="h-full p-4 overflow-auto">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-semibold">学習ワークスペース</h1>
        <div />
      </div>
      {!selId ? (
        <p className="text-sm text-gray-700">左のナビからカードを選択すると、ここで学習できます。</p>
      ) : (
        <CardPlayer courseId={courseId} selectedId={selId} selectedKind={selKind} onNavigate={onNavigate} />
      )}
    </div>
  );
}
