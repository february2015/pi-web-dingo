/**
 * What the user actually wants to see in the dingo panel.
 *
 * Rules lifted from dsh-dingo (`src/feedback.ts` line 400, `CARD_HIDE_AFTER_SEEN_MS`):
 *
 *   show = (status !== 'normal')
 *        OR (now - (conclusionAt ?? lastActivityAt ?? 0) < FRESHNESS_MS)
 *        OR (this session is the swarm owner)   // not applicable to V1
 *
 * "status !== normal" means anything that needs your input (error /
 * question / answered / running) — always show.
 *
 * "now - conclusionAt < FRESHNESS_MS" means: a session that finished
 * less than FRESHNESS_MS ago is still "recent work" worth seeing. After
 * FRESHNESS_MS with status=normal, we assume the user has moved on and
 * the session can disappear from the panel.
 *
 * The active session is always excluded — the user is looking at it
 * directly.
 *
 * Note on time field choice: dsh-dingo prefers `conclusionAt` (when the
 * session actually settled) over `lastActivityAt` (any noise timestamp).
 * A user glancing at a session bumps `lastActivityAt` but doesn't move
 * `conclusionAt` — so conclusion-based freshness matches the user's
 * intent better. We fall back to `lastActivityAt` only when
 * `conclusionAt` is unset.
 */
import type { DashboardSession } from "@blackbelt-technology/pi-dashboard-shared/types.js";
import { classify, type Prio } from "./shared/status.js";

export const FRESHNESS_MS = 60 * 60 * 1000; // 1 hour — matches dsh-dingo

/** Returns true if the session should appear in the panel right now. */
export function shouldShowInPanel(
  session: DashboardSession,
  activeId: string | null,
  now: number = Date.now(),
): boolean {
  if (session.id === activeId) return false;

  // Anything not in the "normal/seen" bucket — always show.
  const prio = classify({ session, activeId, now }).prio;
  if (prio !== 8) return true;

  // prio 8 (idle + seen). Only show if it concluded recently.
  const lastActivity = session.lastActivityAt ?? 0;
  const concludedAt = (session as { conclusionAt?: number }).conclusionAt;
  const baseline = concludedAt ?? lastActivity;
  return baseline > 0 && now - baseline <= FRESHNESS_MS;
}

/** Group sessions for display, applying the show/hide filter. */
export function groupForDisplay(
  sessions: readonly DashboardSession[],
  activeId: string | null,
  now: number = Date.now(),
): Map<Prio, Array<{ session: DashboardSession; sessionId: string }>> {
  const map = new Map<Prio, Array<{ session: DashboardSession; sessionId: string }>>();
  for (const s of sessions) {
    if (!shouldShowInPanel(s, activeId, now)) continue;
    const prio = classify({ session: activeId !== null && s.id === activeId ? { ...s, unread: true } : s, activeId, now }).prio;
    const list = map.get(prio) ?? [];
    list.push({ session: s, sessionId: s.id });
    map.set(prio, list);
  }
  return map;
}
