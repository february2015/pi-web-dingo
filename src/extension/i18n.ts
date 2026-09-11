/**
 * Chrome extension i18n wrapper. chrome.i18n is only available inside
 * extension contexts; falls back to the bundled key when running in
 * dev or outside the extension.
 */
const HAS_I18N =
  typeof chrome !== "undefined" && !!chrome?.i18n?.getMessage;

/** Localized string lookup with fallback. */
export function t(
  key: string,
  substitutions?: string | string[],
): string {
  if (HAS_I18N) {
    try {
      const msg = chrome!.i18n.getMessage(key, substitutions);
      if (msg) return msg;
    } catch {
      /* fall through */
    }
  }
  return key;
}
