/**
 * 8-level status classification.
 * Pure functions: input only depends on DashboardSession + activeId + now.
 * Mirrors dsh-dingo's priority table — see docs/requirements.md §4.
 */
import type { DashboardSession } from "@blackbelt-technology/pi-dashboard-shared/types.js";

export type Prio = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type StateColor =
  | "red" | "orange" | "purple" | "green"
  | "teal" | "lightblue" | "blue" | "gray";

export interface StateEntry {
  prio: Prio;
  color: StateColor;
  label: string;
  /** animation intensity: 'flash' = fastest/strongest, 'pulse' = soft, 'static' = no animation */
  animation: "flash" | "pulse" | "static";
}

const ENDED_GRACE_MS = 30_000;
const STREAMING_OUTPUT_MS = 5_000;

export interface ClassifyInput {
  session: DashboardSession;
  activeId: string | null;
  now?: number;
}

/**
 * Classify one session into one of the 8 priority states.
 *
 * Rules are short-circuited top-down (highest priority first).
 *  - prio=1 error       : status='ended' within grace window after activity
 *  - prio=2 attention    : has followUp queue + not currently streaming
 *  - prio=3 draft       : idle + unread + not in view
 *  - prio=4 unread      : idle + unread (in view) — see session_unread.md for rationale
 *  - prio=5 background  : (V2) active + flows present — V1 always skipped
 *  - prio=6 streaming-output : status='streaming' with currentTool or recent activity
 *  - prio=7 running     : status='streaming' (no output yet) OR compacting
 *  - prio=8 idle        : everything else (completed, seen)
 */
export function classify({ session, activeId, now = Date.now() }: ClassifyInput): StateEntry {
  const status = session.status;
  const unread = session.unread === true;
  const isActive = activeId !== null && activeId === session.id;
  const lastActivity = session.lastActivityAt ?? 0;

  // prio=1: error — only counts within grace window after activity
  if (status === "ended" && lastActivity > 0 && now - lastActivity <= ENDED_GRACE_MS) {
    return { prio: 1, color: "red", label: "异常", animation: "flash" };
  }

  // prio=7 with label override: compacting always wins as a running state
  if (session.compacting === true && status === "streaming") {
    return { prio: 7, color: "blue", label: "压缩中", animation: "pulse" };
  }

  // prio=2: attention — needs your input
  const hasFollowUp =
    (session.pendingQueues?.followUp?.length ?? 0) > 0 ||
    (session.pendingReplaceProposal != null && session.pendingReplaceProposal !== "");
  if (hasFollowUp && status !== "streaming") {
    return { prio: 2, color: "orange", label: "疑问", animation: "pulse" };
  }

  // prio=3: draft — unsent input on an off-screen session
  if (status === "idle" && unread && !isActive) {
    return { prio: 3, color: "purple", label: "草稿", animation: "pulse" };
  }

  // prio=4: unread — finished, needs reading (in-view)
  if (status === "idle" && unread) {
    return { prio: 4, color: "green", label: "待阅读", animation: "static" };
  }

  // prio=6/7: streaming branches (evaluated together)
  if (status === "streaming") {
    if (session.currentTool || now - lastActivity <= STREAMING_OUTPUT_MS) {
      return { prio: 6, color: "lightblue", label: "中间输出", animation: "static" };
    }
    return { prio: 7, color: "blue", label: "执行中", animation: "static" };
  }

  // prio=8: idle & seen (everything else)
  return { prio: 8, color: "gray", label: "正常", animation: "static" };
}

/** Pick the highest-priority entry from a list of sessions. */
export function highestPriority(entries: StateEntry[]): Prio {
  if (entries.length === 0) return 8;
  let min = entries[0]!.prio;
  for (let i = 1; i < entries.length; i++) {
    if (entries[i]!.prio < min) min = entries[i]!.prio;
  }
  return min;
}

/** Group sessions by priority (1..8). Stable insertion order. */
export function groupByPriority(entries: Array<{ entry: StateEntry; sessionId: string }>): Map<Prio, Array<{ entry: StateEntry; sessionId: string }>> {
  const map = new Map<Prio, Array<{ entry: StateEntry; sessionId: string }>>();
  for (const e of entries) {
    const list = map.get(e.entry.prio) ?? [];
    list.push(e);
    map.set(e.entry.prio, list);
  }
  return map;
}