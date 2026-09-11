/**
 * Persistent pill position — saved to localStorage so the dingo pill
 * stays where you dragged it across page loads.
 *
 * Position is stored as { right, top } in pixels. We use `top` rather
 * than `bottom` so the pill's vertical distance from the **top** of
 * the viewport survives a window resize — `bottom` would mean "X px
 * from the bottom edge", which jumps every time the user resizes the
 * browser.
 *
 * Default: vertically centered along the right edge of the viewport
 * (right=16, top ≈ middle - halfPillHeight). The exact default top is
 * resolved at first render — `loadPillPosition()` computes it against
 * the current viewport so the pill sits at the visual center even on
 * weirdly-sized windows.
 */

export interface PillPosition {
  /** px from the right edge of the viewport */
  right: number;
  /** px from the top edge of the viewport */
  top: number;
}

const STORAGE_KEY = "pi-web-dingo.pill-position.v1";

/** Approximate pill height — used only for the default vertical centering. */
const DEFAULT_PILL_HEIGHT_PX = 36;

function clampToViewport(pos: PillPosition): PillPosition {
  if (typeof window === "undefined") return pos;
  const maxRight = Math.max(0, window.innerWidth - 80);
  // Keep the pill at least 4px from the bottom, since we store `top`.
  const maxTop = Math.max(0, window.innerHeight - DEFAULT_PILL_HEIGHT_PX - 4);
  return {
    right: Math.max(0, Math.min(maxRight, pos.right)),
    top: Math.max(0, Math.min(maxTop, pos.top)),
  };
}

export function loadPillPosition(): PillPosition {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return defaultPosition();
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPosition();
    const parsed = JSON.parse(raw) as Partial<PillPosition>;
    if (
      typeof parsed?.right === "number" &&
      typeof parsed?.top === "number" &&
      Number.isFinite(parsed.right) &&
      Number.isFinite(parsed.top) &&
      parsed.right >= 0 &&
      parsed.top >= 0
    ) {
      return clampToViewport(parsed as PillPosition);
    }
  } catch {
    /* corrupted storage — fall through to default */
  }
  return defaultPosition();
}

export function savePillPosition(pos: PillPosition): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
  } catch {
    /* quota / private mode */
  }
}

/** Default: 16px from right, vertically centered. */
function defaultPosition(): PillPosition {
  if (typeof window === "undefined") {
    return { right: 16, top: 0 };
  }
  const halfH = DEFAULT_PILL_HEIGHT_PX / 2;
  const center = Math.max(0, Math.round(window.innerHeight / 2 - halfH));
  return clampToViewport({ right: 16, top: center });
}
