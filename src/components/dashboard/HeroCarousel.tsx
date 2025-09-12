"use client";
import { useEffect, useRef, useState } from "react";
import type { CarouselApi } from "@/components/ui/carousel";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";

type Props = {
  slides: React.ReactNode[];
  intervalMs?: number; // 自動遷移間隔（ms）
};

export function HeroCarousel({ slides, intervalMs = 3500 }: Props) {
  const [api, setApi] = useState<CarouselApi | null>(null);
  const timerRef = useRef<number | null>(null);
  const hoveredRef = useRef(false);
  const focusedRef = useRef(false);
  const [selected, setSelected] = useState(0);
  const lastAutoAtRef = useRef(0);
  const blockUntilRef = useRef(0);
  const MANUAL_BLOCK_MS = 5000; // 手動操作後は常に5秒ブロック
  const AUTO_MIN_MS = 2500;     // 自動遷移の最小間隔（安全側）

  useEffect(() => {
    const media = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    const prefersReduced = !!media?.matches;
    if (!api || prefersReduced) return;

    const start = () => {
      if (timerRef.current != null) return;
      timerRef.current = window.setInterval(() => {
        const now = Date.now();
        if (now < blockUntilRef.current) return;
        api.scrollNext();
        lastAutoAtRef.current = now;
      }, Math.max(AUTO_MIN_MS, intervalMs));
    };
    const stop = () => {
      if (timerRef.current != null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
    const handleVisibility = () => {
      if (document.hidden || hoveredRef.current || focusedRef.current) stop();
      else start();
    };

    start();
    document.addEventListener("visibilitychange", handleVisibility);
    media?.addEventListener?.("change", handleVisibility as EventListener);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibility);
      media?.removeEventListener?.("change", handleVisibility as EventListener);
    };
  }, [api, intervalMs]);

  // Reflect selected index for dot navigation
  useEffect(() => {
    if (!api) return;
    const update = () => setSelected(api.selectedScrollSnap());
    const onPointerDown = () => {
      blockUntilRef.current = Date.now() + MANUAL_BLOCK_MS;
    };
    const onScroll = () => {
      const now = Date.now();
      // 手動スクロール判定: 直近の自動遷移から十分経っていれば手動とみなす
      if (now - lastAutoAtRef.current > 250) {
        blockUntilRef.current = now + MANUAL_BLOCK_MS;
      }
    };
    update();
    api.on("select", update);
    api.on("reInit", update);
    api.on("pointerDown", onPointerDown);
    api.on("scroll", onScroll);
    return () => {
      api.off("select", update);
      api.off("reInit", update);
      api.off("pointerDown", onPointerDown);
      api.off("scroll", onScroll);
    };
  }, [api]);

  return (
    <section aria-label="注目の操作">
      <Carousel
        setApi={setApi}
        opts={{ loop: true }}
        onMouseEnter={() => (hoveredRef.current = true)}
        onMouseLeave={() => (hoveredRef.current = false)}
        onFocus={() => (focusedRef.current = true)}
        onBlur={() => (focusedRef.current = false)}
        className="relative"
      >
        <CarouselContent>
          {slides.map((node, i) => (
            <CarouselItem key={i} className="px-0">
              {node}
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="left-2 sm:left-4" />
        <CarouselNext className="right-2 sm:right-4" />
      </Carousel>
      {/* Dots: placed outside to avoid overlap */}
      <nav
        aria-label="スライドナビゲーション"
        className="mt-4 flex items-center justify-center gap-2"
        onMouseEnter={() => (hoveredRef.current = true)}
        onMouseLeave={() => (hoveredRef.current = false)}
        onFocus={() => (focusedRef.current = true)}
        onBlur={() => (focusedRef.current = false)}
      >
        <span className="sr-only">現在 {selected + 1} / {slides.length}</span>
        {slides.map((_, i) => {
          const active = i === selected;
          return (
            <button
              key={i}
              type="button"
              aria-label={`スライド ${i + 1} / ${slides.length}`}
              aria-current={active ? "true" : undefined}
              onClick={() => {
                blockUntilRef.current = Date.now() + MANUAL_BLOCK_MS;
                api?.scrollTo(i);
              }}
              className="h-3 w-3 rounded-full flex items-center justify-center"
            >
              <span
                className={
                  "block h-[10px] w-[10px] rounded-full transition-colors " +
                  (active
                    ? "bg-black/70 dark:bg-white/90"
                    : "bg-black/25 dark:bg-white/25 hover:bg-black/40 dark:hover:bg-white/40")
                }
              />
            </button>
          );
        })}
      </nav>
    </section>
  );
}

export default HeroCarousel;
