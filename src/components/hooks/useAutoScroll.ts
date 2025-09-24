"use client";
import * as React from "react";

type Options = {
  /** 判定の余白(px)。この距離以内なら「最下部にいる」とみなす */
  nearBottomMargin?: number;
};

/**
 * チャット等のスクロール領域で「下に張り付く」ためのユーティリティ。
 * - スクロール対象の要素(ref)と末尾センチネル(ref)を受け渡し
 * - 末尾センチネルの可視状態で最下部判定を行う
 * - scrollIntoView と scrollTop を併用した堅牢な最下部スクロールを提供
 */
export function useAutoScroll(
  containerRef: React.RefObject<HTMLElement | null>,
  opts: Options = {}
) {
  const { nearBottomMargin = 48 } = opts;
  const endRef = React.useRef<HTMLDivElement | null>(null);
  const atBottomRef = React.useRef<boolean>(true);
  const [atBottom, setAtBottom] = React.useState(true);

  // IntersectionObserver でセンチネルが表示領域に入っているかを監視
  React.useEffect(() => {
    const root = containerRef.current;
    const end = endRef.current;
    if (!root || !end) return;

    // 近接時も「最下部」とみなすため rootMargin の下側に -nearBottomMargin を設定
    const io = new IntersectionObserver(
      (entries) => {
        const isIn = entries[0]?.isIntersecting ?? false;
        atBottomRef.current = isIn;
        setAtBottom(isIn);
      },
      { root, rootMargin: `0px 0px ${-nearBottomMargin}px 0px`, threshold: 0 }
    );
    io.observe(end);
    return () => io.disconnect();
  }, [containerRef, nearBottomMargin]);

  // ユーザースクロールでの状態更新（IntersectionObserver の保険）
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      const isBottom = distance <= nearBottomMargin;
      if (atBottomRef.current !== isBottom) {
        atBottomRef.current = isBottom;
        setAtBottom(isBottom);
      }
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    // 初期判定
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, [containerRef, nearBottomMargin]);

  const scrollToBottom = React.useCallback(
    (behavior: ScrollBehavior = "auto") => {
      const el = containerRef.current;
      const end = endRef.current;
      if (!el || !end) return;
      try {
        // センチネルにスクロール（iOS Safari の挙動対策で fallback も）
        end.scrollIntoView({ block: "end", inline: "nearest", behavior });
        // 念のためもう 1 フレーム後に scrollTop でも合わせる
        requestAnimationFrame(() => {
          el.scrollTop = el.scrollHeight;
        });
      } catch {
        el.scrollTop = el.scrollHeight;
      }
    },
    [containerRef]
  );

  return { endRef, atBottom, scrollToBottom } as const;
}
