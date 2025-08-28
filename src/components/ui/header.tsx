"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { openCommandPalette } from "@/components/ui/command-palette";
import { NotificationCenterButton } from "@/components/ui/notification-center";

export function Header({
  onSearch,
  initialQuery = "",
  minimal = false,
}: {
  onSearch?: (q: string) => void;
  initialQuery?: string;
  minimal?: boolean;
}) {
  const pathname = usePathname();
  const [q, setQ] = useState(initialQuery);
  const showCtas = !minimal;

  return (
    <header className="sticky top-0 z-30 bg-[hsl(var(--bg))]/80 backdrop-blur supports-[backdrop-filter]:bg-[hsl(var(--bg))]/70 border-b border-[hsl(var(--border))]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <div className="flex items-center justify-between">
          <Link href="/" className="font-semibold tracking-tight">Learnify</Link>
          {/* モバイル1段目はロゴのみ。操作は下段の共通ナビに集約 */}
        </div>
        {!minimal && (
          <div className="w-full sm:ml-auto flex-1 sm:max-w-md">
            <label className="sr-only" htmlFor="course-search">コース検索</label>
            <Input
              id="course-search"
              placeholder="コースを検索…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                onSearch?.(e.target.value);
              }}
            />
          </div>
        )}
        {showCtas && (
          <nav className="sm:ml-auto flex flex-wrap items-center gap-1 sm:gap-2">
            <Button onClick={() => openCommandPalette()} aria-label="コマンドパレットを開く" title="⌘K / Ctrl+K" variant="ghost">⌘K</Button>
            <NotificationCenterButton />
            <Button asChild size="sm" variant="default">
              <Link href="/courses/plan">
                <span className="sm:hidden">AI作成</span>
                <span className="hidden sm:inline">AIで作る</span>
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/courses/new">
                <span className="sm:hidden">手動</span>
                <span className="hidden sm:inline">手動で作る</span>
              </Link>
            </Button>
          </nav>
        )}
      </div>
    </header>
  );
}
