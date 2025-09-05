"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
import { listCards as listCardsApi, snapshot as fetchSnapshot } from "@/lib/client-api";
import { workspaceStore } from "@/lib/state/workspace-store";
import { useHydrateDraftsOnce } from "@/lib/state/useHydrateDrafts";

type Props = { courseId: UUID; defaultLayout?: number[]; cookieKey?: string; initialCardId?: string };

export function WorkspaceShell({ courseId, defaultLayout, cookieKey, initialCardId }: Props) {
  const router = useRouter();
  useHydrateDraftsOnce();
  const [selId, setSelId] = React.useState<string | undefined>(undefined);
  const [selKind, setSelKind] = React.useState<"lesson" | "card" | undefined>(undefined);
  const [openNav, setOpenNav] = React.useState(false);
  const [openInspector, setOpenInspector] = React.useState(false);
  // When a lesson (or a card within a lesson) is selected, scope center navigation to that lesson
  const [lessonScopeId, setLessonScopeId] = React.useState<UUID | null>(null);
  // 最新のスコープ推定リクエストを識別して競合を防ぐ
  const scopeReqIdRef = React.useRef(0);

  const handleSelect = React.useCallback(async (
    id: UUID,
    kind: "course" | "lesson" | "card" | "lesson-edit",
    opts?: { context?: "desktop" | "mobile" }
  ) => {
    const ctx = opts?.context ?? "desktop";
    if (kind === "course") {
      if (id !== courseId) {
        router.push(`/courses/${id}/workspace`);
      } else {
        setSelId(undefined);
        setSelKind(undefined);
      }
      setLessonScopeId(null);
      if (ctx === "mobile") setOpenNav(false);
      return;
    }
    if (kind === "lesson-edit") {
      setSelId(id);
      setSelKind("lesson");
      setLessonScopeId(id);
      if (ctx === "mobile") {
        setOpenNav(false);
        setOpenInspector(true);
      }
      return;
    }
    if (kind === "lesson") {
      const first = (await listCardsApi(id))[0];
      if (first) { setSelId(first.id); setSelKind("card"); }
      else { setSelId(undefined); setSelKind(undefined); }
      setLessonScopeId(id);
      if (ctx === "mobile") setOpenNav(false);
      return;
    }
    // card
    setSelId(id);
    setSelKind("card");
    // スコープの算出は下の useEffect に集約（最新選択のみ反映）
    if (ctx === "mobile") setOpenNav(false);
  }, [courseId, router]);

  // 初期選択（学習モードから戻ってきた cardId を反映）
  React.useEffect(() => {
    if (!selId && initialCardId) {
      setSelId(initialCardId);
      setSelKind("card");
    }
  }, [initialCardId]);

  // カード選択時は所属レッスンに自動スコープ（初期遷移/戻る遷移の双方をカバー）
  React.useEffect(() => {
    let active = true;
    (async () => {
      if (!selId || selKind !== "card") return;
      const reqId = ++scopeReqIdRef.current;
      try {
        const snap = await fetchSnapshot();
        // 競合防止: 直近の要求かつ選択が変わっていないことを確認
        if (!active || scopeReqIdRef.current !== reqId) return;
        const found = snap.cards.find((c) => c.id === selId);
        setLessonScopeId(found ? (found.lessonId as UUID) : null);
      } catch {
        // 失敗時はスコープ変更しない（現状維持）
      }
    })();
    return () => {
      active = false;
    };
  }, [selId, selKind]);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="h-[calc(100vh-56px)]">
        <div className="hidden md:block h-full">
            <ResizablePanelGroup
            direction="horizontal"
            autoSaveId={cookieKey ?? `workspace:${courseId}`}
          >
            <ResizablePanel
              defaultSize={defaultLayout?.[0] ?? 24}
              minSize={16}
              className="border-r"
              onPointerDownCapture={() => workspaceStore.setActivePane("nav")}
            >
              <NavTree
                courseId={courseId}
                selectedId={selId}
                onSelect={(id, kind) => { void handleSelect(id, kind, { context: "desktop" }); }}
              />
            </ResizablePanel>
            <ResizableHandle withHandle aria-label="ナビをリサイズ" />
            <ResizablePanel
              defaultSize={defaultLayout?.[1] ?? 48}
              minSize={40}
              className=""
              onPointerDownCapture={() => workspaceStore.setActivePane("center")}
            >
              <CenterPanel
                courseId={courseId}
                selId={selId}
                selKind={selKind}
                lessonScopeId={lessonScopeId ?? undefined}
                onNavigate={(id) => { setSelId(id); setSelKind("card"); }}
              />
            </ResizablePanel>
            <ResizableHandle withHandle aria-label="エディタをリサイズ" />
            <ResizablePanel
              defaultSize={defaultLayout?.[2] ?? 28}
              minSize={18}
              className="border-l"
              onPointerDownCapture={() => workspaceStore.setActivePane("inspector")}
            >
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
                      onSelect={(id, kind) => { void handleSelect(id, kind, { context: "mobile" }); }}
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
                lessonScopeId={lessonScopeId ?? undefined}
                onNavigate={(id) => { setSelId(id); setSelKind("card"); }}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function CenterPanel({ courseId, selId, selKind, lessonScopeId, onNavigate }: { courseId: UUID; selId?: string; selKind?: "lesson"|"card"; lessonScopeId?: UUID; onNavigate: (id: UUID) => void }) {
  return (
    <div className="h-full p-4 overflow-auto">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-semibold">学習ワークスペース</h1>
        <div>
          {/* 学習モードへ遷移（選択中のカードがあればそのカードから開始） */}
          <Button asChild size="sm" variant="outline" aria-label="学習モード">
            {(() => {
              const href = (() => {
                if (selId && selKind === "card") {
                  const q = new URLSearchParams({ cardId: selId });
                  if (lessonScopeId) q.set("lessonId", lessonScopeId);
                  return `/learn/${courseId}?${q.toString()}`;
                }
                if (selId && selKind === "lesson") return `/learn/${courseId}?lessonId=${selId}`;
                return `/learn/${courseId}`;
              })();
              return <Link href={href}>学習モード</Link>;
            })()}
          </Button>
        </div>
      </div>
      {!selId ? (
        <p className="text-sm text-gray-700">左のナビからカードを選択すると、ここで学習できます。</p>
      ) : (
        <CardPlayer courseId={courseId} selectedId={selId} selectedKind={selKind} lessonScopeId={lessonScopeId} onNavigate={onNavigate} />
      )}
    </div>
  );
}
