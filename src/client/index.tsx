/**
 * pi Web Dingo — Chrome extension entry point.
 *
 * Hover behavior:
 * - Hover pill (with intent delay ~150ms) → open panel
 * - Mouse leave pill → start close timer (5s)
 * - Mouse enter panel → cancel close timer
 * - Mouse leave panel → start close timer (5s)
 * - Click pill → toggle (overrides hover state)
 *
 * Pill position:
 * - Default: 16px from right edge, vertically centered.
 * - Drag → position persists to localStorage.
 * - On every load we re-clamp against the current viewport so a window
 *   resize doesn't push the pill off-screen.
 */
import * as React from "react";
import type { DashboardSession } from "@blackbelt-technology/pi-dashboard-shared/types.js";
import { Panel } from "./Panel.js";
import {
  useActiveSessionId,
  useDingoAudioBridge,
  navigateToSession,
} from "./useDingoStore.js";
import { shouldShowInPanel } from "./visibility.js";
import { useDingoCounts } from "./useDingoCounts.js";
import { useDragPill } from "./useDragPill.js";
import {
  loadPillPosition,
  savePillPosition,
} from "./pillPosition.js";
import { loadPinned, savePinned } from "./pinnedState.js";
import { t } from "../extension/i18n.js";
import "./styles.css";

export interface AppProps {
  /** Dashboard URL — unused at runtime, but documented for the content script. */
  dashboardUrl?: string;
}

const HOVER_INTENT_MS = 150;
const LEAVE_GRACE_MS = 5000;

/** Top-level component mounted by the content script. */
export function App(_props: AppProps): React.ReactElement {
  const [pinned, setPinned] = React.useState(loadPinned);
  const [hovered, setHovered] = React.useState(false);
  const pillRef = React.useRef<HTMLButtonElement | null>(null);
  const [pillSize, setPillSize] = React.useState({ width: 0, height: 0 });
  const closeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const openTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── drag + persisted pill position ─────────────────────────────────
  const { pos, isDragging, bind } = useDragPill({
    initial: loadPillPosition(),
  });

  // Save on drag end (when isDragging flips false and pos is settled).
  // We watch pos changes — but persist only when isDragging is false
  // (i.e. the user has released). Effect-driven: only commit when
  // NOT dragging.
  React.useEffect(() => {
    if (!isDragging) savePillPosition(pos);
  }, [pos, isDragging]);

  // Persist pinned state so a refresh keeps the panel locked open.
  React.useEffect(() => {
    savePinned(pinned);
  }, [pinned]);

  const activeId = useActiveSessionId();
  const counts = useDingoCounts();
  // Pill totals reflect only what the user can actually see in the card
  // list (i.e. `useDingoCounts`'s filtered totals) — never raw session
  // count, which can include dozens of long-since-seen sessions.
  const totalSessions =
    counts.error + counts.question + counts.draft + counts.answered +
    counts.waiting + counts.intermediate + counts.running + counts.normal;

  // Active session is always included in counts (it lives in the
  // `normal` bucket), so `count > 0` means "we have sessions to talk
  // about", not "we have problems". Determine "hasAttention" purely
  // from the non-normal, non-active buckets.
  const hasAttention =
    counts.error +
      counts.question +
      counts.draft +
      counts.answered +
      counts.waiting +
      counts.intermediate +
      counts.running >
    0;
  const open = pinned || hovered;

  // ── hover handlers ────────────────────────────────────────────────
  const cancelTimers = React.useCallback(() => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const onPillEnter = React.useCallback(() => {
    cancelTimers();
    if (pinned) return;
    openTimerRef.current = setTimeout(() => {
      setHovered(true);
      openTimerRef.current = null;
    }, HOVER_INTENT_MS);
  }, [pinned, cancelTimers]);

  const onPillLeave = React.useCallback(() => {
    if (pinned) return;
    cancelTimers();
    closeTimerRef.current = setTimeout(() => {
      setHovered(false);
      closeTimerRef.current = null;
    }, LEAVE_GRACE_MS);
  }, [pinned, cancelTimers]);

  const onPanelEnter = React.useCallback(() => cancelTimers(), [cancelTimers]);

  const onPanelLeave = React.useCallback(() => {
    if (pinned) return;
    cancelTimers();
    closeTimerRef.current = setTimeout(() => {
      setHovered(false);
      closeTimerRef.current = null;
    }, LEAVE_GRACE_MS);
  }, [pinned, cancelTimers]);

  const handleNavigate = React.useCallback(
    (sessionId: string) => {
      if (sessionId === activeId) return;
      cancelTimers();
      navigateToSession(sessionId);
      // The user just performed an action — dismiss the panel. If they
      // had it pinned, leave it open so they can keep navigating.
      if (!pinned) setHovered(false);
    },
    [activeId, pinned, cancelTimers],
  );

  const onPillClick = React.useCallback(() => {
    // If this click is the tail of a drag, don't toggle pinned —
    // drags should only move the pill, never change lock state.
    if (bind.shouldIgnoreClick()) return;
    cancelTimers();
    setPinned((p) => !p);
    if (pinned) setHovered(false);
  }, [pinned, cancelTimers, bind]);

  // Measure the pill so the panel can sit exactly under it. Without
  // this, the panel used `pos.top` (pill's top edge) which left it
  // overlapping the pill itself.
  React.useLayoutEffect(() => {
    if (!pillRef.current) return;
    const el = pillRef.current;
    const update = () => {
      const r = el.getBoundingClientRect();
      setPillSize((prev) =>
        prev.width === r.width && prev.height === r.height
          ? prev
          : { width: r.width, height: r.height },
      );
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [pos.right, pos.top]);

  React.useEffect(() => {
    return () => {
      if (openTimerRef.current) clearTimeout(openTimerRef.current);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  return (
    <div className="dingo-root">
      <button
        ref={pillRef}
        type="button"
        className={`dingo-pill ${hasAttention ? "dingo-pill-attention" : "dingo-pill-idle"} ${isDragging ? "dingo-pill-dragging" : ""}`}
        style={bind.style}
        onClick={onPillClick}
        onPointerDown={bind.onPointerDown}
        onPointerMove={bind.onPointerMove}
        onPointerUp={bind.onPointerUp}
        onPointerCancel={bind.onPointerUp}
        onMouseEnter={onPillEnter}
        onMouseLeave={onPillLeave}
        onFocus={onPillEnter}
        onBlur={onPillLeave}
        aria-expanded={open}
        aria-label={
          hasAttention
            ? t("pillAriaLabelAttention", [
                String(totalSessions),
                String(counts.error + counts.question + counts.draft + counts.answered + counts.waiting + counts.intermediate + counts.running),
              ])
            : t("pillAriaLabelAllNormal")
        }
        title={t("pillTitleHint")}
      >
        <span className="dingo-pill-icon" aria-hidden="true">
          <svg viewBox="0 0 32 32" width="24" height="24">
            <text
              x="16"
              y="23"
              text-anchor="middle"
              font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', system-ui, sans-serif"
              font-weight="800"
              font-size="24"
              fill="#67e8f9"
              letter-spacing="-1">D</text>
          </svg>
        </span>
        <span className="dingo-pill-units">
          {counts.error > 0 && (
            <span className="dingo-pill-unit" title="异常">
              <span className="dingo-pill-dot dingo-pill-dot-error">{"\u200B"}</span>
              <span className="dingo-pill-num">{counts.error}</span>
            </span>
          )}
          {counts.question > 0 && (
            <span className="dingo-pill-unit" title="疑问">
              <span className="dingo-pill-dot dingo-pill-dot-question">{"\u200B"}</span>
              <span className="dingo-pill-num">{counts.question}</span>
            </span>
          )}
          {counts.draft > 0 && (
            <span className="dingo-pill-unit" title="草稿">
              <span className="dingo-pill-dot dingo-pill-dot-draft">{"\u200B"}</span>
              <span className="dingo-pill-num">{counts.draft}</span>
            </span>
          )}
          {counts.answered > 0 && (
            <span className="dingo-pill-unit" title="待阅读">
              <span className="dingo-pill-dot dingo-pill-dot-answered">{"\u200B"}</span>
              <span className="dingo-pill-num">{counts.answered}</span>
            </span>
          )}
          {counts.running > 0 && (
            <span className="dingo-pill-unit" title="执行中">
              <span className="dingo-pill-spinner">{"\u200B"}</span>
              <span className="dingo-pill-num">{counts.running}</span>
            </span>
          )}
          {counts.intermediate > 0 && (
            <span className="dingo-pill-unit" title="中间输出">
              <span className="dingo-pill-dot dingo-pill-dot-intermediate">{"\u200B"}</span>
              <span className="dingo-pill-num">{counts.intermediate}</span>
            </span>
          )}
          {counts.waiting > 0 && (
            <span className="dingo-pill-unit" title="等待后台/子任务">
              <span className="dingo-pill-dot dingo-pill-dot-waiting">{"\u200B"}</span>
              <span className="dingo-pill-num">{counts.waiting}</span>
            </span>
          )}
          {counts.normal > 0 && (
            <span className="dingo-pill-unit" title="正常">
              <span className="dingo-pill-dot dingo-pill-dot-normal">{"\u200B"}</span>
              <span className="dingo-pill-num">{counts.normal}</span>
            </span>
          )}
          {counts.normal === 0 && (
            <span className="dingo-pill-unit" title="正常">
              <span className="dingo-pill-dot dingo-pill-dot-normal">{"\u200B"}</span>
              <span className="dingo-pill-num">0</span>
            </span>
          )}
        </span>
        {pinned && <span className="dingo-pill-pin" aria-hidden="true">📎</span>}
      </button>
      {open && (
        <div
          className="dingo-panel dingo-root"
          style={{
            right: Math.max(8, pos.right - 8),
            top: pos.top + pillSize.height + 8,
          }}
          onMouseEnter={onPanelEnter}
          onMouseLeave={onPanelLeave}
        >
          <Panel onNavigate={handleNavigate} />
        </div>
      )}
    </div>
  );
}
