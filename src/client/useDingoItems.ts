/**
 * Dingo items — single source of truth for "what shows up in the card
 * list". Panel renders these, `useDingoCounts` aggregates these into
 * the 8 priority buckets for the pill summary. Sharing this hook
 * guarantees the pill numbers never drift from the card list.
 *
 * Rules:
 *  - Active session is always included (it's marked with `isCurrent`).
 *  - Non-active sessions pass `shouldShowInPanel` (prio != 8 OR
 *    concluded within FRESHNESS_MS).
 *  - Sort: prio ASC, lastActivityAt DESC within each prio group.
 *
 * Note: a "draft" state for off-screen sessions with unsent input
 * would be valuable (matches dsh-dingo), but the Chrome extension
 * can't reliably read other sessions' composer state — DOM probing
 * only covers the active session, and dashboard doesn't expose a
 * draft API. We skip the draft bucket entirely.
 */
import * as React from "react";
import type { DashboardSession } from "@blackbelt-technology/pi-dashboard-shared/types.js";
import { useDingoSessions, useActiveSessionId } from "./useDingoStore.js";
import { classify } from "./shared/status.js";
import { shouldShowInPanel } from "./visibility.js";

export interface DingoItem {
  session: DashboardSession;
  isCurrent: boolean;
}

export function useDingoItems(): DingoItem[] {
  const sessions = useDingoSessions();
  const activeId = useActiveSessionId();
  // No useMemo: we want the latest data on every render. Counting
  // sessions is O(n) and n is small (< 100), so memoization isn't
  // worth the staleness risk during fast updates.
  const out: DingoItem[] = [];
  for (const s of sessions as DashboardSession[]) {
    const isCurrent = s.id === activeId;
    if (!isCurrent && !shouldShowInPanel(s, activeId)) continue;
    out.push({ session: s, isCurrent });
  }
  out.sort((a, b) => {
    const ea = classify({ session: a.session, activeId });
    const eb = classify({ session: b.session, activeId });
    if (ea.prio !== eb.prio) return ea.prio - eb.prio;
    return (b.session.lastActivityAt ?? 0) - (a.session.lastActivityAt ?? 0);
  });
  return out;
}
