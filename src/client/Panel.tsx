/**
 * Panel — flat list of session cards, modeled on dsh-dingo's
 * SessionCardRailCompact expanded view.
 *
 * Layout (left → right per row):
 *   - Status icon (14x14, color by priority)
 *   - Body: workspace name (small, muted) + session title (bold, truncate)
 *   - Trailing meta: relative time + any sub-badges (draft / swarm)
 *
 * No grouping headers, no large priority badges. The grouping happens
 * visually via the icon + color, and the order (sorted by rank in
 * `visibility.ts`) puts the most important cards at the top.
 */
import * as React from "react";
import { useActiveSessionId } from "./useDingoStore.js";
import { classify, type Prio } from "./shared/status.js";
import { useDingoItems } from "./useDingoItems.js";

/* Card icon glyphs. prio 4/7/8 are pure shape (solid square, spinner,
   grey dot) so the slot is left empty — the CSS color/shape does the
   work. prio 1/2/3/5/6 keep a single-character glyph inside a solid
   shape so the priority reads even at small card width. */
const PRIO_ICON: Record<Prio, string> = {
  1: "!",
  2: "?",
  3: "✎",
  4: "",
  5: "⌛",
  6: "↻",
  7: "",
  8: "",
};

function relTime(ms: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - ms);
  if (diff < 60_000) return "刚刚";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  return `${Math.floor(diff / 86_400_000)} 天前`;
}

function basename(p: string): string {
  if (!p) return "";
  const parts = p.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? p;
}

export function Panel({
  onNavigate,
}: {
  onNavigate: (sessionId: string) => void;
}): React.ReactElement {
  const items = useDingoItems();
  const activeId = useActiveSessionId();
  const [dismissed, setDismissed] = React.useState<Set<string>>(new Set());

  // (Sorting is already done inside `useDingoItems`, so items is ready
  //  to render in order.)

  const handleCardClick = (sessionId: string) => {
    onNavigate(sessionId);
  };

  const handleDismiss = React.useCallback((sessionId: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(sessionId);
      return next;
    });
  }, []);

  const visibleItems = React.useMemo(
    () => items.filter((it) => !dismissed.has(it.session.id)),
    [items, dismissed],
  );

  return (
    <ul className="dingo-card-list">
      {visibleItems.map(({ session: s, isCurrent }) => {
            const sessionId = s.id;
            const entry = classify({ session: s, activeId });
            const prio = entry.prio;
            const ws = basename(s.cwd);
            const title =
              s.name?.trim() ||
              basename(s.cwd) ||
              sessionId.slice(0, 8);
            const t = s.lastActivityAt ? relTime(s.lastActivityAt) : "—";
            return (
              <li key={sessionId} className={`dingo-card-li dingo-prio-${prio} ${isCurrent ? "dingo-card-current" : ""}`}>
                <div
                  role="button"
                  tabIndex={0}
                  className={`dingo-card dingo-prio-${prio} ${isCurrent ? "dingo-card-current" : ""}`}
                  onClick={() => handleCardClick(sessionId)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleCardClick(sessionId);
                    }
                  }}
                  title={isCurrent ? `当前 · ${title}` : `跳转到 ${title}`}
                >
                  {isCurrent && <span className="dingo-card-current-bar" aria-hidden="true" />}
                  {isCurrent && <span className="dingo-card-current-tag">当前</span>}
                  <span className={`dingo-card-icon dingo-prio-${prio}`}>
                    {PRIO_ICON[prio]}
                  </span>
                  <span className="dingo-card-body">
                    <span className="dingo-card-ws">{ws}</span>
                    <span className="dingo-card-title">{title}</span>
                  </span>
                  <span className="dingo-card-meta">
                    {s.unread === true && (
                      <span className="dingo-card-unread-dot" title="未读" />
                    )}
                    <span className="dingo-card-time">{t}</span>
                  </span>
                  <button
                    type="button"
                    className="dingo-card-close"
                    aria-label="关闭"
                    title="关闭"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDismiss(sessionId);
                    }}
                  >
                    ×
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
  );
}
