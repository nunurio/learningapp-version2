import * as React from "react";

interface FloatingPanelOptions {
  mobileQuery?: string;
  launcherSuppressMs?: number;
  margin?: number;
}

interface PanelHandlers {
  onPointerDownCapture: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerUpCapture: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerCancelCapture: () => void;
  onClickCapture: () => void;
  onClick: (event: React.MouseEvent<HTMLElement>) => void;
}

export interface FloatingPanelController {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  toggleOpen: () => void;
  close: () => void;
  maximized: boolean;
  setMaximized: React.Dispatch<React.SetStateAction<boolean>>;
  isMobile: boolean;
  cardRef: React.MutableRefObject<HTMLDivElement | null>;
  cardStyle: React.CSSProperties;
  panelHandlers: PanelHandlers;
  launcherStyle: React.CSSProperties;
  launcherLocked: boolean;
  handleLauncherToggle: () => void;
  handleDragPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  handleResizePointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  handleResizeKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
}

const DEFAULT_OPTIONS: Required<FloatingPanelOptions> = {
  mobileQuery: "(max-width: 768px)",
  launcherSuppressMs: 400,
  margin: 8,
};

type Position = { right: number; bottom: number };
type Size = { w: number; h: number };

export function useFloatingPanel(options?: FloatingPanelOptions): FloatingPanelController {
  const { mobileQuery, launcherSuppressMs, margin } = { ...DEFAULT_OPTIONS, ...options };

  const [open, setOpen] = React.useState(false);
  const [maximized, setMaximized] = React.useState(false);
  const [launcherLocked, setLauncherLocked] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    return window.matchMedia(mobileQuery).matches;
  });

  const cardRef = React.useRef<HTMLDivElement>(null);
  const unlockLauncherTimerRef = React.useRef<number | null>(null);
  const pendingLauncherReleaseRef = React.useRef<number | null>(null);
  const suppressLauncherClickRef = React.useRef(false);
  const lastInternalPointerEventRef = React.useRef(0);

  const posRef = React.useRef<Position>({ right: 16, bottom: 16 });
  const sizeRef = React.useRef<Size>({ w: 360, h: 480 });
  const rafRef = React.useRef<number | null>(null);

  const [pos, setPos] = React.useState<Position>(posRef.current);
  const [size, setSize] = React.useState<Size>(sizeRef.current);

  React.useEffect(() => {
    posRef.current = pos;
  }, [pos]);

  React.useEffect(() => {
    sizeRef.current = size;
  }, [size]);

  React.useEffect(() => {
    if (!open && maximized) setMaximized(false);
  }, [open, maximized]);

  React.useEffect(() => {
    if (!open) return;
    if (isMobile && !maximized) setMaximized(true);
  }, [isMobile, maximized, open]);

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(mobileQuery);
    const update = (event?: MediaQueryListEvent) => {
      setIsMobile(event?.matches ?? media.matches);
    };
    update();
    if (typeof media.addEventListener === "function") {
      const handler = (event: MediaQueryListEvent) => update(event);
      media.addEventListener("change", handler);
      return () => media.removeEventListener("change", handler);
    }
    if (typeof media.addListener === "function") {
      const legacyHandler = (event: MediaQueryListEvent) => update(event);
      media.addListener(legacyHandler);
      return () => media.removeListener(legacyHandler);
    }
    return undefined;
  }, [mobileQuery]);

  React.useEffect(() => {
    if (!maximized) return;
    if (typeof document === "undefined" || typeof window === "undefined") return;
    const docEl = document.documentElement;
    const body = document.body;
    const prevDocOverflow = docEl.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    body.dataset.aiChatMaximized = "true";
    docEl.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      docEl.style.overflow = prevDocOverflow;
      body.style.overflow = prevBodyOverflow;
      delete body.dataset.aiChatMaximized;
      window.scrollTo(scrollX, scrollY);
    };
  }, [maximized]);

  React.useEffect(() => {
    return () => {
      if (unlockLauncherTimerRef.current != null) {
        clearTimeout(unlockLauncherTimerRef.current);
        unlockLauncherTimerRef.current = null;
      }
      if (pendingLauncherReleaseRef.current != null) {
        clearTimeout(pendingLauncherReleaseRef.current);
        pendingLauncherReleaseRef.current = null;
      }
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  const lockLauncher = React.useCallback(() => {
    setLauncherLocked(true);
    if (unlockLauncherTimerRef.current != null) {
      clearTimeout(unlockLauncherTimerRef.current);
      unlockLauncherTimerRef.current = null;
    }
  }, []);

  const unlockLauncherSoon = React.useCallback(() => {
    if (unlockLauncherTimerRef.current != null) {
      clearTimeout(unlockLauncherTimerRef.current);
    }
    unlockLauncherTimerRef.current = window.setTimeout(() => {
      setLauncherLocked(false);
      unlockLauncherTimerRef.current = null;
    }, launcherSuppressMs);
  }, [launcherSuppressMs]);

  const markLauncherSuppress = React.useCallback(() => {
    suppressLauncherClickRef.current = true;
    lastInternalPointerEventRef.current = Date.now();
    if (pendingLauncherReleaseRef.current != null) {
      clearTimeout(pendingLauncherReleaseRef.current);
      pendingLauncherReleaseRef.current = null;
    }
  }, []);

  const releaseLauncherSuppress = React.useCallback(() => {
    lastInternalPointerEventRef.current = Date.now();
    if (!suppressLauncherClickRef.current) return;
    if (pendingLauncherReleaseRef.current != null) {
      clearTimeout(pendingLauncherReleaseRef.current);
    }
    pendingLauncherReleaseRef.current = window.setTimeout(() => {
      suppressLauncherClickRef.current = false;
      pendingLauncherReleaseRef.current = null;
    }, launcherSuppressMs);
  }, [launcherSuppressMs]);

  const clampPos = React.useCallback(
    (w: number, h: number, right: number, bottom: number): Position => {
      try {
        const iw = window.innerWidth;
        const ih = window.innerHeight;
        const maxRight = Math.max(margin, iw - w - margin);
        const maxBottom = Math.max(margin, ih - h - margin);
        return {
          right: Math.min(Math.max(margin, right), maxRight),
          bottom: Math.min(Math.max(margin, bottom), maxBottom),
        };
      } catch {
        return { right, bottom };
      }
    },
    [margin],
  );

  const applyPosStyle = React.useCallback((right: number, bottom: number) => {
    const el = cardRef.current;
    if (!el) return;
    el.style.right = `${right}px`;
    el.style.bottom = `${bottom}px`;
  }, []);

  const clearPosStyle = React.useCallback(() => {
    const el = cardRef.current;
    if (!el) return;
    el.style.right = "";
    el.style.bottom = "";
  }, []);

  const cardStyle = React.useMemo<React.CSSProperties>(() => {
    const base: React.CSSProperties = {
      transform: "translateZ(0)",
      willChange: "transform",
      contain: "paint",
    };
    if (maximized) {
      return {
        ...base,
        top: "max(0px, env(safe-area-inset-top, 0px))",
        right: "max(0px, env(safe-area-inset-right, 0px))",
        bottom: "max(0px, env(safe-area-inset-bottom, 0px))",
        left: "max(0px, env(safe-area-inset-left, 0px))",
        width: "auto",
        height: "auto",
      } satisfies React.CSSProperties;
    }
    return {
      ...base,
      top: "",
      left: "",
      right: pos.right,
      bottom: pos.bottom,
      width: size.w,
      height: size.h,
    } satisfies React.CSSProperties;
  }, [maximized, pos.right, pos.bottom, size.w, size.h]);

  const launcherStyle = React.useMemo<React.CSSProperties>(
    () => ({
      position: "fixed",
      right: "max(16px, calc(env(safe-area-inset-right, 0px) + 16px))",
      bottom: "max(16px, calc(env(safe-area-inset-bottom, 0px) + 16px))",
      left: "auto",
      top: "auto",
      zIndex: 100,
      background: "linear-gradient(135deg, hsl(var(--primary-500)), hsl(var(--primary-600)))",
      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      pointerEvents: launcherLocked ? "none" : "auto",
    }),
    [launcherLocked],
  );

  const handleDragPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (maximized) return;
      const target = event.currentTarget as HTMLElement | null;
      const pointerId = event.pointerId;
      if (target) target.style.touchAction = "none";
      const startX = event.clientX;
      const startY = event.clientY;
      const startPos = { ...posRef.current };
      try {
        target?.setPointerCapture(pointerId);
      } catch {
        /* no-op */
      }

      markLauncherSuppress();
      lockLauncher();

      if (cardRef.current) {
        cardRef.current.dataset.dragging = "true";
        cardRef.current.style.transition = "none";
      }
      if (target) target.dataset.dragging = "true";

      let lastDx = 0;
      let lastDy = 0;

      const onMove = (ev: PointerEvent) => {
        lastDx = ev.clientX - startX;
        lastDy = ev.clientY - startY;
        const next = clampPos(sizeRef.current.w, sizeRef.current.h, startPos.right - lastDx, startPos.bottom - lastDy);
        applyPosStyle(next.right, next.bottom);
      };

      const onUp = () => {
        try {
          target?.releasePointerCapture(pointerId);
        } catch {
          /* no-op */
        }
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        if (rafRef.current != null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        const next = clampPos(sizeRef.current.w, sizeRef.current.h, startPos.right - lastDx, startPos.bottom - lastDy);
        setPos(next);
        clearPosStyle();
        if (target) target.style.touchAction = "";
        if (cardRef.current) {
          delete cardRef.current.dataset.dragging;
          cardRef.current.style.transition = "";
        }
        if (target) delete target.dataset.dragging;
        releaseLauncherSuppress();
        unlockLauncherSoon();
      };

      window.addEventListener("pointermove", onMove, { passive: true } as AddEventListenerOptions);
      window.addEventListener("pointerup", onUp, { passive: true } as AddEventListenerOptions);
      window.addEventListener("pointercancel", onUp, { passive: true } as AddEventListenerOptions);
    },
    [applyPosStyle, clampPos, clearPosStyle, lockLauncher, markLauncherSuppress, maximized, releaseLauncherSuppress, unlockLauncherSoon],
  );

  const handleResizePointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (maximized) return;
      const target = event.currentTarget as HTMLElement | null;
      const pointerId = event.pointerId;
      try {
        target?.setPointerCapture(pointerId);
      } catch {
        /* no-op */
      }

      markLauncherSuppress();
      lockLauncher();

      const startX = event.clientX;
      const startY = event.clientY;
      const startSize = { ...sizeRef.current };
      const startPos = { ...posRef.current };

      let lastW = startSize.w;
      let lastH = startSize.h;
      let lastRight = startPos.right;
      let lastBottom = startPos.bottom;

      if (cardRef.current) {
        cardRef.current.dataset.resizing = "true";
        cardRef.current.style.transition = "none";
      }

      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        const nextW = Math.min(560, Math.max(320, startSize.w + dx));
        const nextH = Math.min(640, Math.max(280, startSize.h + dy));
        const dW = nextW - startSize.w;
        const dH = nextH - startSize.h;
        const unclampedRight = startPos.right - dW;
        const unclampedBottom = startPos.bottom - dH;
        const clamped = clampPos(nextW, nextH, unclampedRight, unclampedBottom);
        lastW = nextW;
        lastH = nextH;
        lastRight = clamped.right;
        lastBottom = clamped.bottom;
        const el = cardRef.current;
        if (el) {
          el.style.width = `${lastW}px`;
          el.style.height = `${lastH}px`;
          el.style.right = `${lastRight}px`;
          el.style.bottom = `${lastBottom}px`;
        }
      };

      const onUp = () => {
        try {
          target?.releasePointerCapture(pointerId);
        } catch {
          /* no-op */
        }
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        if (rafRef.current != null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        const nextSize = { w: lastW, h: lastH };
        setSize(nextSize);
        const nextPos = clampPos(nextSize.w, nextSize.h, lastRight, lastBottom);
        setPos(nextPos);
        const el = cardRef.current;
        if (el) {
          el.style.width = "";
          el.style.height = "";
          el.style.right = "";
          el.style.bottom = "";
          delete el.dataset.resizing;
          el.style.transition = "";
        }
        releaseLauncherSuppress();
        unlockLauncherSoon();
      };

      window.addEventListener("pointermove", onMove, { passive: true } as AddEventListenerOptions);
      window.addEventListener("pointerup", onUp, { passive: true } as AddEventListenerOptions);
      window.addEventListener("pointercancel", onUp, { passive: true } as AddEventListenerOptions);
    },
    [clampPos, lockLauncher, markLauncherSuppress, maximized, releaseLauncherSuppress, unlockLauncherSoon],
  );

  const handleResizeKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      const step = event.shiftKey ? 32 : 16;
      let dw = 0;
      let dh = 0;
      if (event.key === "ArrowRight") dw = step;
      else if (event.key === "ArrowLeft") dw = -step;
      else if (event.key === "ArrowDown") dh = step;
      else if (event.key === "ArrowUp") dh = -step;
      else return;
      event.preventDefault();
      const startW = sizeRef.current.w;
      const startH = sizeRef.current.h;
      const nextW = Math.min(560, Math.max(320, startW + dw));
      const nextH = Math.min(640, Math.max(280, startH + dh));
      const dW = nextW - startW;
      const dH = nextH - startH;
      const nextPos = clampPos(nextW, nextH, posRef.current.right - dW, posRef.current.bottom - dH);
      setSize({ w: nextW, h: nextH });
      setPos(nextPos);
    },
    [clampPos],
  );

  const handlePanelPointerDownCapture = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      markLauncherSuppress();
      lockLauncher();
    },
    [lockLauncher, markLauncherSuppress],
  );

  const handlePanelPointerUpCapture = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      releaseLauncherSuppress();
      unlockLauncherSoon();
    },
    [releaseLauncherSuppress, unlockLauncherSoon],
  );

  const handlePanelPointerCancelCapture = React.useCallback(() => {
    releaseLauncherSuppress();
    unlockLauncherSoon();
  }, [releaseLauncherSuppress, unlockLauncherSoon]);

  const handlePanelClickCapture = React.useCallback(() => {
    markLauncherSuppress();
    releaseLauncherSuppress();
  }, [markLauncherSuppress, releaseLauncherSuppress]);

  const handlePanelClick = React.useCallback((event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
  }, []);

  const shouldIgnoreLauncherToggle = React.useCallback(() => {
    const now = Date.now();
    if (launcherLocked) return true;
    if (suppressLauncherClickRef.current) {
      if (now - lastInternalPointerEventRef.current < launcherSuppressMs) {
        suppressLauncherClickRef.current = false;
        return true;
      }
      suppressLauncherClickRef.current = false;
    }
    return false;
  }, [launcherLocked, launcherSuppressMs]);

  const toggleOpen = React.useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      if (!next) {
        setMaximized(false);
      } else if (isMobile) {
        setMaximized(true);
      }
      return next;
    });
  }, [isMobile]);

  const close = React.useCallback(() => {
    setOpen(false);
    setMaximized(false);
  }, []);

  const handleLauncherToggle = React.useCallback(() => {
    if (shouldIgnoreLauncherToggle()) return;
    toggleOpen();
  }, [shouldIgnoreLauncherToggle, toggleOpen]);

  const panelHandlers: PanelHandlers = React.useMemo(
    () => ({
      onPointerDownCapture: handlePanelPointerDownCapture,
      onPointerUpCapture: handlePanelPointerUpCapture,
      onPointerCancelCapture: handlePanelPointerCancelCapture,
      onClickCapture: handlePanelClickCapture,
      onClick: handlePanelClick,
    }),
    [handlePanelClick, handlePanelClickCapture, handlePanelPointerCancelCapture, handlePanelPointerDownCapture, handlePanelPointerUpCapture],
  );

  return {
    open,
    setOpen,
    toggleOpen,
    close,
    maximized,
    setMaximized,
    isMobile,
    cardRef,
    cardStyle,
    panelHandlers,
    launcherStyle,
    launcherLocked,
    handleLauncherToggle,
    handleDragPointerDown,
    handleResizePointerDown,
    handleResizeKeyDown,
  };
}
