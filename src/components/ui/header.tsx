"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
        <Link href="/" className="font-semibold tracking-tight">Learnify</Link>
        {!minimal && (
          <div className="ml-auto flex-1 max-w-md">
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
          <nav className="ml-auto flex items-center gap-2">
            <Button asChild variant="default"><Link href="/courses/plan">AIで作る</Link></Button>
            <Button asChild variant="outline"><Link href="/courses/new">手動で作る</Link></Button>
          </nav>
        )}
      </div>
    </header>
  );
}
