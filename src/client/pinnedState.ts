/**
 * Persistent pinned state — whether the dingo panel is locked open.
 * Stored in localStorage so the user's preference survives reloads.
 *
 * Mirrors the design of `pillPosition.ts`: explicit storage key
 * versioned so future schema changes can migrate cleanly.
 */

const STORAGE_KEY = "pi-web-dingo.pinned.v1";

export function loadPinned(): boolean {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return false;
  }
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function savePinned(pinned: boolean): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, pinned ? "1" : "0");
  } catch {
    /* quota / private mode */
  }
}
