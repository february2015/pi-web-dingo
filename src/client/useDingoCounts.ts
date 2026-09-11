/**
 * Sum items into the 8 priority buckets used for the pill summary and
 * the folder chip. Items come from `useDingoItems`, so this hook and
 * the Panel can never disagree on what's "in the list".
 *
 * The active session is bucketed by its REAL priority, not forced into
 * `normal`. If the user is looking at a streaming session, the pill
 * should show "执行中 1" so they can tell at a glance that work is
 * happening on it.
 */
import * as React from "react";
import { useActiveSessionId } from "./useDingoStore.js";
import { classify, type Prio } from "./shared/status.js";
import { useDingoItems } from "./useDingoItems.js";

export interface DingoCounts {
  /** prio 1 — error / ended-within-grace */
  error: number;
  /** prio 2 — has follow-up, needs your input */
  question: number;
  /** prio 3 — draft on an off-screen session */
  draft: number;
  /** prio 4 — finished, unread, in view */
  answered: number;
  /** prio 5 — background / jobs running */
  waiting: number;
  /** prio 6 — streaming with output */
  intermediate: number;
  /** prio 7 — streaming, no output yet */
  running: number;
  /** prio 8 — idle & seen */
  normal: number;
}

export const EMPTY_COUNTS: DingoCounts = {
  error: 0,
  question: 0,
  draft: 0,
  answered: 0,
  waiting: 0,
  intermediate: 0,
  running: 0,
  normal: 0,
};

/** prio → bucket key. Active session keeps its real priority. */
function bucketFor(prio: Prio): keyof DingoCounts {
  switch (prio) {
    case 1: return "error";
    case 2: return "question";
    case 3: return "draft";
    case 4: return "answered";
    case 5: return "waiting";
    case 6: return "intermediate";
    case 7: return "running";
    case 8: return "normal";
  }
}

/**
 * Sum items into buckets. Same source as the Panel list, so the pill
 * numbers always match what the user actually sees in the card list.
 */
export function useDingoCounts(): DingoCounts {
  const items = useDingoItems();
  const activeId = useActiveSessionId();
  // No useMemo: recompute every render so the pill is never stale.
  const out: DingoCounts = { ...EMPTY_COUNTS };
  for (const { session } of items) {
    const prio = classify({ session, activeId }).prio;
    out[bucketFor(prio)] += 1;
  }
  return out;
}
