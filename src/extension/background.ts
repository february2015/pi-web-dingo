/**
 * Background service worker — maintains a single dashboard WebSocket
 * connection per dashboard tab and forwards session updates to the
 * content script that asked for them.
 *
 * Why a service worker (not the content script directly):
 *  - Content scripts get torn down on page reload / SPA route change.
 *    A background port survives and can buffer the next snapshot.
 *  - The dashboard origin is `localhost:8000` — from a content script
 *    we could open the WS, but each route push re-mounts components
 *    and the WS would need to re-handshake.
 *
 * Message protocol:
 *  - From content: { type: "start", dashboardUrl }
 *                  { type: "stop" }
 *  - To content:   { type: "snapshot", sessions }
 *                  { type: "update",   sessions }
 *                  { type: "status", connected, error? }
 */

// Chrome extension service worker API
/// <reference types="chrome" />

interface ChromePort {
  name: string;
  postMessage(msg: unknown): void;
  onMessage: { addListener(cb: (msg: unknown) => void): void };
  onDisconnect: { addListener(cb: () => void): void };
  disconnect(): void;
}

// --- Per-port session state ----------------------------------------------

interface PortState {
  port: ChromePort;
  dashboardUrl: string;
  ws: WebSocket | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  /** True until the first snapshot arrives — used to send `snapshot` vs `update` */
  hasReceivedInitial: boolean;
}

const ports = new Map<ChromePort, PortState>();

function wsUrlFor(dashboardUrl: string): string {
  const u = new URL(dashboardUrl);
  u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
  u.pathname = "/ws";
  return u.toString();
}

function sendSnapshot(state: PortState, sessions: unknown[]): void {
  try {
    if (!state.hasReceivedInitial) {
      state.port.postMessage({ type: "snapshot", sessions });
      state.hasReceivedInitial = true;
    } else {
      state.port.postMessage({ type: "update", sessions });
    }
  } catch {
    /* port closed mid-send */
  }
}

function sendStatus(state: PortState, connected: boolean, error?: string): void {
  try {
    state.port.postMessage({ type: "status", connected, error });
  } catch {
    /* port closed mid-send */
  }
}

async function fetchInitial(state: PortState): Promise<void> {
  try {
    const res = await fetch(`${state.dashboardUrl}/api/sessions`, {
      credentials: "include",
    });
    if (!res.ok) return;
    const data = (await res.json()) as { sessions?: unknown[] };
    if (Array.isArray(data.sessions)) {
      sendSnapshot(state, data.sessions);
    }
  } catch {
    /* network error — WS may still recover */
  }
}

function connectWs(state: PortState): void {
  try {
    const ws = new WebSocket(wsUrlFor(state.dashboardUrl));
    state.ws = ws;
    ws.onopen = () => sendStatus(state, true);
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string) as
          | { type: "sessions_snapshot" | "sessions_list"; sessions?: unknown[] }
          | { type: "session_added" | "session_updated"; session?: unknown }
          | { type: "session_removed" | "session_orphaned"; sessionId?: string };
        if (
          (msg.type === "sessions_snapshot" || msg.type === "sessions_list") &&
          Array.isArray(msg.sessions)
        ) {
          sendSnapshot(state, msg.sessions);
        } else if (
          (msg.type === "session_added" || msg.type === "session_updated") &&
          msg.session
        ) {
          // Incrementally merge — we send the single updated session and
          // tell the content side to refetch the full snapshot so its
          // internal store stays canonical. (Simpler than maintaining a
          // delta view on this side.)
          void fetchInitial(state);
        } else if (
          (msg.type === "session_removed" || msg.type === "session_orphaned") &&
          msg.sessionId
        ) {
          void fetchInitial(state);
        }
      } catch {
        /* malformed message — ignore */
      }
    };
    ws.onerror = () => sendStatus(state, false, "websocket error");
    ws.onclose = () => {
      sendStatus(state, false, "websocket closed");
      state.ws = null;
      if (state.reconnectTimer) return;
      state.reconnectTimer = setTimeout(() => {
        state.reconnectTimer = null;
        connectWs(state);
      }, 5_000);
    };
  } catch (e) {
    sendStatus(state, false, `connect failed: ${(e as Error).message}`);
    if (!state.reconnectTimer) {
      state.reconnectTimer = setTimeout(() => {
        state.reconnectTimer = null;
        connectWs(state);
      }, 5_000);
    }
  }
}

function startPort(port: ChromePort, dashboardUrl: string): void {
  if (ports.has(port)) return;
  const state: PortState = {
    port,
    dashboardUrl,
    ws: null,
    reconnectTimer: null,
    hasReceivedInitial: false,
  };
  ports.set(port, state);
  void fetchInitial(state);
  connectWs(state);
}

function stopPort(port: ChromePort): void {
  const state = ports.get(port);
  if (!state) return;
  if (state.reconnectTimer) clearTimeout(state.reconnectTimer);
  if (state.ws) {
    try { state.ws.close(); } catch { /* ignore */ }
  }
  ports.delete(port);
}

if (typeof chrome !== "undefined" && chrome.runtime?.onConnect) {
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== "dingo-content") return;
    port.onMessage.addListener((msg) => {
      if (!msg || typeof msg !== "object") return;
      const m = msg as { type?: string; dashboardUrl?: string };
      if (m.type === "start" && typeof m.dashboardUrl === "string") {
        startPort(port, m.dashboardUrl);
      } else if (m.type === "stop") {
        stopPort(port);
      }
    });
    port.onDisconnect.addListener(() => stopPort(port));
  });
}
