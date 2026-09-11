/**
 * Drag-to-move for the dingo pill.
 *
 * Implementation note: we attach `pointermove` / `pointerup` /
 * `pointercancel` directly to the bound element. The bound element
 * captures the pointer on `pointerdown`, which guarantees that all
 * subsequent pointer events fire on it even if the cursor leaves it.
 * This avoids window-listener race conditions and "drag still active
 * after unmount" bugs.
 *
 * Position is tracked as `{ right, top }` in viewport px. `top` rather
 * than `bottom` because the pill's vertical distance from the top edge
 * survives a window resize.
 *
 * Click vs drag: a `pointerdown` → `pointerup` within 4px of the start
 * counts as a click. We expose `isDragging` so the caller can decide
 * whether to react to the subsequent `click` event.
 *
 * Cursor: `grab` while idle, `grabbing` while dragging. `touchAction:
 * none` is required so touch devices don't treat the gesture as a
 * scroll.
 */
import * as React from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";

export interface PillPosition {
  right: number;
  top: number;
}

interface UseDragPillOpts {
  initial?: PillPosition;
  dragThresholdPx?: number;
}

interface UseDragPillResult {
  pos: PillPosition;
  isDragging: boolean;
  bind: {
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
    onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void;
    /** Wire this to onClick. Returns true when the click is the
     *  result of a drag (not a real click), so callers skip
     *  click-side effects like toggling pinned. */
    shouldIgnoreClick: () => boolean;
    style: CSSProperties;
  };
}

const DEFAULT_RIGHT = 16;
const APPROX_HALF_HEIGHT = 18;

function defaultPosition(): PillPosition {
  if (typeof window === "undefined") {
    return { right: DEFAULT_RIGHT, top: 0 };
  }
  const center = Math.max(
    0,
    Math.round(window.innerHeight / 2 - APPROX_HALF_HEIGHT),
  );
  return { right: DEFAULT_RIGHT, top: center };
}

function clamp(pos: PillPosition, vw: number, vh: number): PillPosition {
  const EDGE_PAD = 8;
  const maxRight = Math.max(0, vw - 80);
  const maxTop = Math.max(0, vh - 40);
  return {
    right: Math.max(EDGE_PAD, Math.min(maxRight, pos.right)),
    top: Math.max(EDGE_PAD, Math.min(maxTop, pos.top)),
  };
}

export function useDragPill(opts: UseDragPillOpts = {}): UseDragPillResult {
  const {
    initial = defaultPosition(),
    dragThresholdPx = 4,
  } = opts;
  const [pos, setPos] = React.useState<PillPosition>(initial);
  const [isDragging, setIsDragging] = React.useState(false);

  // Where on the pill the user grabbed, captured at pointerdown.
  const grabRef = React.useRef<{
    dx: number;
    dy: number;
    x: number;
    y: number;
    pointerId: number;
  } | null>(null);
  // True once the pointer has moved past the drag threshold.
  const startedRef = React.useRef(false);
  // True when the upcoming browser-dispatched `click` should be
  // ignored because the pointerup followed a drag. Reset on the
  // first read of shouldIgnoreClick().
  const ignoreNextClickRef = React.useRef(false);

  const onPointerDown = React.useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      const target = e.currentTarget;
      const rect = target.getBoundingClientRect();
      grabRef.current = {
        dx: e.clientX - rect.left,
        dy: e.clientY - rect.top,
        x: e.clientX,
        y: e.clientY,
        pointerId: e.pointerId,
      };
      startedRef.current = false;
      try {
        target.setPointerCapture(e.pointerId);
      } catch {
        /* ignore — old browser */
      }
      e.preventDefault();
    },
    [],
  );

  const onPointerMove = React.useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const grab = grabRef.current;
      if (!grab || e.pointerId !== grab.pointerId) return;
      const dx = Math.abs(e.clientX - grab.x);
      const dy = Math.abs(e.clientY - grab.y);
      if (!startedRef.current) {
        if (dx < dragThresholdPx && dy < dragThresholdPx) return;
        startedRef.current = true;
        setIsDragging(true);
      }
      const rect = e.currentTarget.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const newLeft = e.clientX - grab.dx;
      const newTop = e.clientY - grab.dy;
      const right = Math.max(0, vw - newLeft - rect.width);
      const top = Math.max(0, newTop);
      setPos(clamp({ right, top }, vw, vh));
    },
    [dragThresholdPx],
  );

  const onPointerUp = React.useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const grab = grabRef.current;
      if (!grab || e.pointerId !== grab.pointerId) return;
      grabRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      if (startedRef.current) {
        // Drag completed. Mark the next click (which the browser will
        // dispatch after pointerup) as a drag, not a click — so the
        // caller's onClick handler can skip toggling pinned.
        ignoreNextClickRef.current = true;
        setTimeout(() => {
          setIsDragging(false);
          startedRef.current = false;
        }, 0);
      }
      // If !startedRef.current → the user clicked. Let the React
      // onClick fire normally; the pill's click handler will toggle
      // the panel.
    },
    [],
  );

  // Re-clamp on window resize so the pill never ends up off-screen
  // after the user resizes the browser.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => {
      setPos((p) => clamp(p, window.innerWidth, window.innerHeight));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return {
    pos,
    isDragging,
    bind: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      shouldIgnoreClick: () => {
        if (ignoreNextClickRef.current) {
          ignoreNextClickRef.current = false;
          return true;
        }
        return false;
      },
      style: {
        right: pos.right,
        top: pos.top,
        touchAction: "none",
        cursor: isDragging ? "grabbing" : "grab",
      },
    },
  };
}
