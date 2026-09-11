/**
 * Dingo session store — Chrome extension edition.
 *
 * Talks to the dashboard's REST API (`/api/sessions`) and WebSocket
 * (`/ws`) via the extension's background service worker (see
 * `src/extension/background.ts`). The content script never opens the
 * WebSocket directly — it asks the background to do it and listens for
 * `sessions_updated` messages back.
 *
 * Why: a content script's fetch() can hit the dashboard directly (same
 * origin or via cookies), but a WebSocket opened from content-script
 * context gets killed when the page navigates. Routing through the
 * background service worker keeps the connection alive across SPA
 * route changes inside the dashboard.
 */
import * as React from "react";
import type { DashboardSession } from "@blackbelt-technology/pi-dashboard-shared/types.js";
import { classify, type Prio } from "./shared/status.js";
import { DING_WAV_DATA_URL } from "./dingDataUrl.js";

// --- Chrome extension types (use @types/chrome) ----------------------------

type ToBg =
  | { type: "start"; dashboardUrl: string }
  | { type: "stop" };
type FromBg =
  | { type: "snapshot"; sessions: DashboardSession[] }
  | { type: "update"; sessions: DashboardSession[] }
  | { type: "status"; connected: boolean; error?: string };

const HAS_CHROME =
  typeof chrome !== "undefined" && !!chrome?.runtime?.sendMessage;

// --- Module-level state --------------------------------------------------

let _sessions: DashboardSession[] = [];
const _listeners = new Set<(s: DashboardSession[]) => void>();
let _connected = false;
let _port: chrome.runtime.Port | null = null;

function emit(): void {
  for (const l of _listeners) l(_sessions);
}

function handleBgMessage(msg: unknown): void {
  if (!msg || typeof msg !== "object") return;
  const m = msg as FromBg;
  if (m.type === "snapshot" || m.type === "update") {
    _sessions = Array.isArray(m.sessions) ? m.sessions : [];
    _connected = true;
    emit();
  } else if (m.type === "status") {
    _connected = m.connected;
    emit();
  }
}

function ensurePort(dashboardUrl: string): chrome.runtime.Port | null {
  if (!HAS_CHROME) return null;
  if (_port) return _port;
  const port = chrome!.runtime.connect({ name: "dingo-content" });
  port.onMessage.addListener((m) => handleBgMessage(m));
  port.onDisconnect.addListener(() => {
    _port = null;
    _connected = false;
    emit();
  });
  _port = port;
  // Tell background to start the WS session
  port.postMessage({ type: "start", dashboardUrl } satisfies ToBg);
  return port;
}

export function startDingoStore(dashboardUrl: string): void {
  ensurePort(dashboardUrl);
  // Same-origin fetch as a fast first paint — don't wait for the
  // background service worker's WS round-trip. If it fails (no cookies,
  // wrong origin, etc.) the background stream is still the source of
  // truth and will populate the store when its first snapshot lands.
  void fetchInitialFromOrigin(dashboardUrl);
  // REST poll fallback: the background WS may use a message-type name
  // we don't recognize, in which case live updates never reach the
  // content script. Poll /api/sessions periodically so status changes
  // (streaming → idle, etc.) are reflected within a few seconds.
  startRestPolling(dashboardUrl);
}

/** Pull a session array out of whatever shape the dashboard returns. */
function extractSessions(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of ["sessions", "data", "items", "results", "list"]) {
      if (Array.isArray(obj[key])) return obj[key] as unknown[];
    }
  }
  return [];
}

let _restPollTimer: ReturnType<typeof setInterval> | null = null;
const REST_POLL_INTERVAL_MS = 5_000;

function startRestPolling(dashboardUrl: string): void {
  if (_restPollTimer !== null) return;
  const tick = async (): Promise<void> => {
    try {
      const res = await fetch(`${dashboardUrl}/api/sessions`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const text = await res.text();
      let data: unknown;
      try { data = JSON.parse(text); } catch { data = text; }
      const list = extractSessions(data);
      if (list.length > 0) {
        _sessions = list as DashboardSession[];
        emit();
      }
    } catch {
      /* network blip — try again next tick */
    }
  };
  _restPollTimer = setInterval(() => void tick(), REST_POLL_INTERVAL_MS);
}

async function fetchInitialFromOrigin(dashboardUrl: string): Promise<void> {
  try {
    const res = await fetch(`${dashboardUrl}/api/sessions`, {
      credentials: "include",
    });
    if (!res.ok) return;
    const text = await res.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = text; }
    const list = extractSessions(data);
    if (list.length > 0) {
      _sessions = list as DashboardSession[];
      _connected = true;
      emit();
    }
  } catch {
    /* CORS / network — background WS will eventually deliver. */
  }
}

export function stopDingoStore(): void {
  if (_restPollTimer !== null) {
    clearInterval(_restPollTimer);
    _restPollTimer = null;
  }
  if (_port) {
    try {
      _port.postMessage({ type: "stop" } satisfies ToBg);
    } catch {
      /* port already closed */
    }
    _port.disconnect();
    _port = null;
  }
  _sessions = [];
  _connected = false;
  emit();
}

export function getSnapshot(): readonly DashboardSession[] {
  return _sessions;
}

export function isConnected(): boolean {
  return _connected;
}

export function subscribe(listener: (s: readonly DashboardSession[]) => void): () => void {
  _listeners.add(listener as (s: DashboardSession[]) => void);
  return () => {
    _listeners.delete(listener as (s: DashboardSession[]) => void);
  };
}

// --- Module-level URL tracking (shared across all hook instances) -----

let _currentPath: string =
  typeof window !== "undefined" ? window.location.pathname : "";
let _urlSubscribers = new Set<(path: string) => void>();
let _pushStatePatched = false;
let _origPushState: typeof history.pushState | null = null;
let _origReplaceState: typeof history.replaceState | null = null;

function notifyUrlSubscribers(): void {
  const next = currentLocationKey();
  if (next === _currentPath) return;
  _currentPath = next;
  for (const sub of _urlSubscribers) sub(_currentPath);
}

/**
 * Read the full URL identity (path + hash + search) into a single
 * string. Any change in any part triggers subscribers.
 */
function currentLocationKey(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname + window.location.search + window.location.hash;
}

function patchHistory(): void {
  if (_pushStatePatched) return;
  if (typeof window === "undefined") return;
  _pushStatePatched = true;
  _origPushState = history.pushState.bind(history);
  _origReplaceState = history.replaceState.bind(history);
  history.pushState = function (
    this: History,
    ...args: Parameters<typeof history.pushState>
  ): void {
    const ret = _origPushState!.apply(this, args);
    notifyUrlSubscribers();
    return ret as unknown as void;
  };
  history.replaceState = function (
    this: History,
    ...args: Parameters<typeof history.replaceState>
  ): void {
    const ret = _origReplaceState!.apply(this, args);
    notifyUrlSubscribers();
    return ret as unknown as void;
  };
  window.addEventListener("popstate", notifyUrlSubscribers);
  // Hash-only routers (Vue Router default hash mode, etc.) don't call
  // pushState at all — they just change `window.location.hash`. The
  // `hashchange` event covers that case.
  window.addEventListener("hashchange", notifyUrlSubscribers);
  // Fallback poll at 250 ms: catches routers that mutate location in
  // some other way (e.g. directly assigning `window.history.state`,
  // or using a custom navigation library that bypasses the standard
  // History API). Cheap — only notifies if the key changed.
  setInterval(notifyUrlSubscribers, 250);
}

function subscribeUrl(sub: (path: string) => void): () => void {
  patchHistory();
  _urlSubscribers.add(sub);
  return () => {
    _urlSubscribers.delete(sub);
  };
}

// --- React hooks ----------------------------------------------------------

/** Reactive list of all dashboard sessions, sorted stable by id. */
export function useDingoSessions(): DashboardSession[] {
  const [snap, setSnap] = React.useState<readonly DashboardSession[]>(_sessions);
  React.useEffect(() => subscribe((s) => setSnap(s)), []);
  return snap as DashboardSession[];
}

/** Convenience: derive the currently-active session id from the URL. */
export function useActiveSessionId(): string | null {
  const [key, setKey] = React.useState<string>(_currentPath);
  React.useEffect(() => subscribeUrl(setKey), []);
  // `key` is pathname + search + hash; we only inspect pathname to
  // extract the session id, but we keep the rest in the value so
  // hash-only and query-string-only routers also trigger updates.
  const pathname = key ? key.replace(/[?#].*$/, "") : "";
  const m = pathname.match(/^\/session\/([^/]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

/** Snapshot of attention-needed session ids (excludes the one the user is viewing). */
export function useAttentionSessionIds(activeId: string | null): string[] {
  const sessions = useDingoSessions();
  return React.useMemo(() => {
    const out: string[] = [];
    for (const s of sessions) {
      if (s.id === activeId) continue;
      if (s.status !== "idle") continue;
      if (s.unread !== true) continue;
      out.push(s.id);
    }
    return out;
  }, [sessions, activeId]);
}

// --- Navigation helper ----------------------------------------------------

/** Navigate to a dashboard session. Tries SPA history first, falls back to hard nav. */
export function navigateToSession(sessionId: string): void {
  if (typeof window === "undefined") return;
  const url = `/session/${encodeURIComponent(sessionId)}`;
  // SPA route push; if no host (e.g. dashboard not loaded), the URL
  // change still works because we update window.location.pathname.
  try {
    window.history.pushState({}, "", url);
    window.dispatchEvent(new PopStateEvent("popstate"));
  } catch {
    window.location.href = url;
  }
}

// --- Audio bridge ---------------------------------------------------------

interface UseDingoAudioBridgeOpts {
  activeId: string | null;
  dedupeWindowMs?: number;
  volume?: number;
  soundEnabled?: boolean;
}

const lastPlayAt = new Map<string, number>();

/**
 * React hook: play chime when a non-active session transitions
 * `streaming → idle` while `unread=true`.
 */
export function useDingoAudioBridge(opts: UseDingoAudioBridgeOpts): void {
  const sessions = useDingoSessions();
  const { dedupeWindowMs = 10_000, volume = 0.6, soundEnabled = true } = opts;
  const prevRef = React.useRef<DashboardSession[]>([]);

  React.useEffect(() => {
    if (!soundEnabled) return;
    const prev = prevRef.current;
    for (const s of sessions) {
      const before = prev.find((p) => p.id === s.id);
      const wasStreaming = before?.status === "streaming";
      const nowIdle = s.status === "idle";
      const becameUnread = before?.unread !== true && s.unread === true;
      if (becameUnread && s.id !== opts.activeId) {
        const last = lastPlayAt.get(s.id) ?? 0;
        if (Date.now() - last < dedupeWindowMs) continue;
        lastPlayAt.set(s.id, Date.now());
        void playDing(volume);
      }
    }
    prevRef.current = sessions;
  }, [sessions, opts.activeId, soundEnabled, dedupeWindowMs, volume]);
}

async function playDing(volume: number): Promise<void> {
  try {
    const audio = new Audio(DING_WAV_DATA_URL);
    audio.volume = Math.max(0, Math.min(1, volume));
    await audio.play();
  } catch {
    /* autoplay rejected — silent */
  }
}
