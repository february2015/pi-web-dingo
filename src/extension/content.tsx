/**
 * Content script — entry point for the pi Web Dingo Chrome extension.
 *
 * Detection strategy:
 *   1. The content script is injected on every page (`<all_urls>`),
 *      because the dashboard can be reached via arbitrary hostnames /
 *      ports / tunnels (localhost, 127.0.0.1, LAN IP, FRP-mapped
 *      domain, etc.) and we don't want users to have to edit the
 *      manifest for every setup.
 *   2. Before mounting, we probe the dashboard's REST API at
 *      `${origin}/api/sessions`. A successful response with a
 *      `sessions` array confirms we're on a pi dashboard. Anything
 *      else (timeout, 404, CORS denial, HTML login page) is treated
 *      as "not the dashboard" and the content script silently exits
 *      without touching the page.
 *
 * Once mounted, the React app (`src/client/index.tsx`) lives inside
 * a Shadow DOM so its CSS cannot collide with the dashboard's styles.
 */
import { createRoot, type Root } from "react-dom/client";
import * as React from "react";
import { App } from "../client/index.js";
import { startDingoStore, stopDingoStore } from "../client/useDingoStore.js";

const HOST_ID = "pi-web-dingo-host";
const PROBE_TIMEOUT_MS = 3_000;

let root: Root | null = null;

function getOrigin(): string {
  if (typeof window === "undefined") return "http://localhost:8000";
  return `${window.location.protocol}//${window.location.host}`;
}

/**
 * Probe the dashboard's REST API. Returns true only when the endpoint
 * responds with a JSON object/array containing a `sessions` field.
 * Anything else (HTML, empty body, 401/403/404, CORS rejection) is
 * treated as "not the dashboard".
 */
async function probeDashboard(origin: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  const url = `${origin}/api/sessions`;
  try {
    const res = await fetch(url, {
      credentials: "include",
      signal: controller.signal,
    });
    if (!res.ok) return false;
    const text = await res.text();
    if (!text) return false;
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { return false; }
    if (Array.isArray(parsed)) return true;
    if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      // Accepted shapes: { sessions: [...] }, { data: [...] }, or any
      // single-key object whose value is an array. The dashboard
      // wraps its payload as { success: true, data: [...] }.
      for (const key of ["sessions", "data"]) {
        if (Array.isArray(obj[key])) return true;
      }
      for (const v of Object.values(obj)) {
        if (Array.isArray(v)) return true;
      }
    }
    return false;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function mount(dashboardUrl: string): void {
  if (document.getElementById(HOST_ID)) return;

  // Create the host element
  const host = document.createElement("div");
  host.id = HOST_ID;
  host.style.cssText = [
    "position: fixed",
    "top: 0",
    "right: 0",
    "z-index: 2147483647", // max int — sit above everything
    "max-height: 70vh",
    "pointer-events: auto",
    "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  ].join(";");

  // Attach shadow root (open so DevTools can inspect during dev)
  const shadow = host.attachShadow({ mode: "open" });
  const mountPoint = document.createElement("div");
  shadow.appendChild(mountPoint);

  // Inject a <link> for the stylesheet into the shadow root so dingo's
  // own CSS rules apply (and not the host's)
  const styleLink = document.createElement("link");
  styleLink.rel = "stylesheet";
  // chrome.runtime.getURL is available inside the extension at runtime
  // even though our ambient `chrome` type is intentionally narrow here.
  styleLink.href =
    typeof chrome !== "undefined" && chrome.runtime
      ? (chrome.runtime as unknown as { getURL: (p: string) => string }).getURL("dingo.css")
      : "/dingo.css";
  shadow.appendChild(styleLink);

  document.body.appendChild(host);

  // React 18 root API
  root = createRoot(mountPoint);
  root.render(React.createElement(App, { dashboardUrl }));

  // Start the background service worker stream
  startDingoStore(dashboardUrl);
}

function unmount(): void {
  stopDingoStore();
  root?.unmount();
  root = null;
  document.getElementById(HOST_ID)?.remove();
}

async function bootstrap(): Promise<void> {
  const origin = getOrigin();
  const ok = await probeDashboard(origin);
  if (!ok) {
    // Not a pi dashboard — leave the page untouched.
    return;
  }
  mount(origin);
}

void bootstrap();

// Clean up if the page is being torn down (rare for SPAs but good hygiene)
window.addEventListener("pagehide", unmount);
