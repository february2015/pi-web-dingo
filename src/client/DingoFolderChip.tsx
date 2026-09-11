/**
 * DingoFolderChip — small badge that shows a folder's session-priority
 * summary. In the Chrome-extension edition, this is one of the visual
 * surfaces dingo renders inside its own Shadow-DOM-mounted UI (not
 * injected into the dashboard's sidebar).
 *
 * Click behavior: when there are attention sessions, click navigates the
 * active browser tab to the first attention session.
 */
import * as React from "react";
import {
  useDingoSessions,
  useActiveSessionId,
  navigateToSession,
} from "./useDingoStore.js";
import type { Prio } from "./shared/status.js";
import { useDingoCounts, type DingoCounts } from "./useDingoCounts.js";

const PRIO_DOT_COLOR: Record<Prio, string> = {
  1: "rgb(239, 68, 68)",
  2: "rgb(249, 115, 22)",
  3: "rgb(168, 85, 247)",
  4: "rgb(34, 197, 94)",
  5: "rgb(20, 184, 166)",
  6: "rgb(103, 232, 249)",
  7: "rgb(59, 130, 246)",
  8: "rgb(148, 163, 184)",
};

function prioCount(counts: DingoCounts, prio: Prio): number {
  switch (prio) {
    case 1: return counts.error;
    case 2: return counts.question;
    case 3: return counts.draft;
    case 4: return counts.answered;
    case 5: return counts.waiting;
    case 6: return counts.intermediate;
    case 7: return counts.running;
    case 8: return counts.normal;
  }
}

export function DingoFolderChip(): React.ReactElement | null {
  const sessions = useDingoSessions();
  const activeId = useActiveSessionId();
  const counts = useDingoCounts();

  const totalActive =
    counts.error + counts.question + counts.draft + counts.answered +
    counts.waiting + counts.intermediate + counts.running + counts.normal;

  const visible: Array<{ prio: Prio; count: number }> = (
    [1, 2, 3, 4, 5, 6, 7] as Prio[]
  )
    .map((prio) => ({ prio, count: prioCount(counts, prio) }))
    .filter((x) => x.count > 0);

  const firstAttentionId = React.useMemo(() => {
    for (const s of sessions) {
      if (s.id === activeId) continue;
      if (s.status !== "idle") continue;
      if (s.unread !== true) continue;
      return s.id;
    }
    return null;
  }, [sessions, activeId]);

  const onClick = React.useCallback(() => {
    if (firstAttentionId) navigateToSession(firstAttentionId);
  }, [firstAttentionId]);

  if (totalActive === 0) return null;

  return (
    <div
      className="dingo-folder-chip"
      role={firstAttentionId ? "button" : undefined}
      tabIndex={firstAttentionId ? 0 : undefined}
      onClick={firstAttentionId ? onClick : undefined}
      onKeyDown={
        firstAttentionId
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      title={
        firstAttentionId
          ? "dingo · 点击跳到待读 session"
          : "dingo · 各 session 优先级概览(无待读)"
      }
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "2px 8px",
        borderRadius: 999,
        background: firstAttentionId
          ? "rgba(245, 158, 11, 0.18)"
          : "rgba(99, 102, 241, 0.12)",
        border: firstAttentionId
          ? "1px solid rgba(245, 158, 11, 0.45)"
          : "1px solid rgba(99, 102, 241, 0.3)",
        color: firstAttentionId ? "rgb(245, 158, 11)" : "rgb(165, 180, 252)",
        fontSize: 10,
        fontWeight: 600,
        cursor: firstAttentionId ? "pointer" : "default",
        userSelect: "none",
      }}
    >
      <span aria-hidden="true">🐕</span>
      <span>dingo</span>
      {visible.length > 0 && (
        <span style={{ display: "inline-flex", gap: 4, marginLeft: 2 }}>
          {visible.map(({ prio, count }) => (
            <span
              key={prio}
              className={`dingo-mini-pip dingo-prio-${prio}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 2,
              }}
              title={`优先级 ${prio}: ${count} 个`}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: PRIO_DOT_COLOR[prio],
                  display: "inline-block",
                }}
              />
              <span>{count}</span>
            </span>
          ))}
        </span>
      )}
    </div>
  );
}
