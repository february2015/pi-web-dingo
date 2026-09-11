/**
 * Content script — entry point for the pi Web Dingo Chrome extension.
 *
 * When injected into a page (matches http://localhost:8000/* by default),
 * this script:
 *
 *   1. Creates a Shadow DOM host on `document.body` so dingo's CSS does
 *      not collide with the dashboard's styles.
 *   2. Mounts the React app into that shadow root.
 *   3. Connects to the extension's background service worker via
 *      `chrome.runtime.connect`, asking it to start streaming sessions
 *      from the dashboard.
 *
 * The actual UI rendering (panel, chip, audio bridge) happens inside
 * `src/client/index.tsx`.
 */
import { createRoot, type Root } from "react-dom/client";
import * as React from "react";
import { App } from "../client/index.js";
import { startDingoStore, stopDingoStore } from "../client/useDingoStore.js";

const HOST_ID = "pi-web-dingo-host";
const DASHBOARD_URL = (() => {
  if (typeof window === "undefined") return "http://localhost:8000";
  return `${window.location.protocol}//${window.location.host}`;
})();

let root: Root | null = null;

function mount(): void {
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
  root.render(React.createElement(App, { dashboardUrl: DASHBOARD_URL }));

  // Start the background service worker stream
  startDingoStore(DASHBOARD_URL);
}

function unmount(): void {
  stopDingoStore();
  root?.unmount();
  root = null;
  document.getElementById(HOST_ID)?.remove();
}

mount();

// Clean up if the page is being torn down (rare for SPAs but good hygiene)
window.addEventListener("pagehide", unmount);
