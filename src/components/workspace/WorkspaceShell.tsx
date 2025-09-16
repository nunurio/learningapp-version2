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
import { useWorkspace, workspaceStore } from "@/lib/state/workspace-store";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useHydrateDraftsOnce } from "@/lib/state/useHydrateDrafts";
import { publishActiveRef } from "@/components/ai/active-ref";

type Props = { courseId: UUID; defaultLayout?: number[]; cookieKey?: string; initialCardId?: string };

export function WorkspaceShell({ courseId, defaultLayout, cookieKey, initialCardId }: Props) {
  const router = useRouter();
  useHydrateDraftsOnce();
  const workspace = useWorkspace();
  const [selId, setSelId] = React.useState<string | undefined>(undefined);
  const [selKind, setSelKind] = React.useState<"lesson" | "card" | undefined>(undefined);
  const [openNav, setOpenNav] = React.useState(false);
  const [openInspector, setOpenInspector] = React.useState(false);
  // When a lesson (or a card within a lesson) is selected, scope center navigation to that lesson
  const [lessonScopeId, setLessonScopeId] = React.useState<UUID | null>(null);
  // 最新のスコープ推定リクエストを識別して競合を防ぐ
  const scopeReqIdRef = React.useRef(0);

  const dirtyCardIds = React.useMemo(() => Object.keys(workspace.drafts), [workspace.drafts]);
  const hasUnsaved = dirtyCardIds.length > 0;
  const [pendingAction, setPendingAction] = React.useState<(() => void) | null>(null);

  const ensureSafe = React.useCallback((action: () => void) => {
    if (!hasUnsaved) {
      action();
      return true;
    }
    setPendingAction(() => action);
    return false;
  }, [hasUnsaved]);

  const guardedNavigate = React.useCallback((href: string) => {
    return ensureSafe(() => router.push(href));
  }, [ensureSafe, router]);

  React.useEffect(() => {
    if (!hasUnsaved) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsaved]);

  const handleSelect = React.useCallback((
    id: UUID,
    kind: "course" | "lesson" | "card" | "lesson-edit",
    opts?: { context?: "desktop" | "mobile" }
  ) => {
    const ctx = opts?.context ?? "desktop";
    const sameTarget =
      (kind === "card" && selKind === "card" && selId === id) ||
      (kind === "lesson" && selKind === "lesson" && selId === id) ||
      (kind === "lesson-edit" && selKind === "lesson" && selId === id) ||
      (kind === "course" && id === courseId && selId === undefined && selKind === undefined);

    const run = async () => {
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
      setSelId(id);
      setSelKind("card");
      if (ctx === "mobile") setOpenNav(false);
    };

    if (!sameTarget) {
      const executed = ensureSafe(() => { void run(); });
      if (!executed) return;
      return;
    }

    void run();
  }, [courseId, ensureSafe, listCardsApi, router, selId, selKind]);

  const handleCardNavigate = React.useCallback((id: UUID) => {
    if (selKind === "card" && selId === id) return;
    const executed = ensureSafe(() => {
      setSelId(id);
      setSelKind("card");
    });
    if (!executed) return;
  }, [ensureSafe, selId, selKind]);

  // ルートの cardId クエリに同期（新規作成直後/学習からの戻りの双方をカバー）
  React.useEffect(() => {
    if (initialCardId) {
      setSelId(initialCardId);
      setSelKind("card");
    }
  }, [initialCardId]);

  React.useEffect(() => {
    if (!selId) {
      publishActiveRef({ courseId, mode: "workspace" });
      return;
    }
    if (selKind === "card") return; // CardPlayer がより詳細な情報を publish
    if (selKind === "lesson") {
      publishActiveRef({ courseId, lessonId: selId, mode: "workspace" });
      return;
    }
    publishActiveRef({ courseId, mode: "workspace" });
  }, [courseId, selId, selKind]);

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

  const learnHref = React.useMemo(() => {
    if (selId && selKind === "card") {
      const params = new URLSearchParams({ cardId: selId });
      if (lessonScopeId) params.set("lessonId", lessonScopeId);
      return `/learn/${courseId}?${params.toString()}`;
    }
    if (selId && selKind === "lesson") {
      return `/learn/${courseId}?lessonId=${selId}`;
    }
    return `/learn/${courseId}`;
  }, [courseId, selId, selKind, lessonScopeId]);

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
              className="relative after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-gradient-to-b after:from-transparent after:via-[hsl(var(--border-default)_/_0.5)] after:to-transparent"
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
                learnHref={learnHref}
                onNavigate={handleCardNavigate}
                onGuardedNavigate={guardedNavigate}
              />
            </ResizablePanel>
            <ResizableHandle withHandle aria-label="エディタをリサイズ" />
            <ResizablePanel
              defaultSize={defaultLayout?.[2] ?? 28}
              minSize={18}
              className="relative before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-gradient-to-b before:from-transparent before:via-[hsl(var(--border-default)_/_0.5)] before:to-transparent"
              onPointerDownCapture={() => workspaceStore.setActivePane("inspector")}
            >
              <Inspector courseId={courseId} selectedId={selId} selectedKind={selKind} />
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>

        <div className="md:hidden h-full">
          <div className="px-3 py-2 relative after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-gradient-to-r after:from-transparent after:via-[hsl(var(--border-default)_/_0.6)] after:to-transparent flex items-center justify-between">
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
              <Button asChild size="sm" variant="outline" aria-label="学習モード" className="whitespace-nowrap">
                <Link
                  href={learnHref}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    guardedNavigate(learnHref);
                  }}
                >
                  学習モード
                </Link>
              </Button>
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
                onNavigate={handleCardNavigate}
              />
            )}
          </div>
        </div>
      </main>
      <AlertDialog open={pendingAction != null} onOpenChange={(open) => { if (!open) setPendingAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>保存されていない変更があります</AlertDialogTitle>
            <AlertDialogDescription>
              保存せずに移動すると変更が失われます。移動してもよろしいですか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingAction(null)}>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const action = pendingAction;
                setPendingAction(null);
                for (const cardId of dirtyCardIds) workspaceStore.clearDraft(cardId as UUID);
                if (dirtyCardIds.length > 0) workspaceStore.bumpVersion();
                action?.();
              }}
            >
              保存せずに移動
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CenterPanel({ courseId, selId, selKind, lessonScopeId, learnHref, onNavigate, onGuardedNavigate }: { courseId: UUID; selId?: string; selKind?: "lesson"|"card"; lessonScopeId?: UUID; learnHref: string; onNavigate: (id: UUID) => void; onGuardedNavigate: (href: string) => boolean }) {
  return (
    <div className="h-full p-4 overflow-auto">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-semibold">学習ワークスペース</h1>
        <div>
          {/* 学習モードへ遷移（選択中のカードがあればそのカードから開始） */}
          <Button asChild size="sm" variant="outline" aria-label="学習モード" className="whitespace-nowrap">
            <Link
              href={learnHref}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onGuardedNavigate(learnHref);
              }}
            >
              学習モード
            </Link>
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
