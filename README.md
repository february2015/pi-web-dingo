# pi Web Dingo

[English](README.md) · [简体中文](README.zh_CN.md)

A small Chrome extension that floats a session-status pill over the
[`pi`](https://github.com/) dashboard, so you can see at a glance which
session needs your input and jump to it without clicking around.

![pill screenshot — placeholder](docs/screenshot.png)

## Features

- 🛰 **Live status pill** floating over the dashboard — see how many
  sessions are running, errored, waiting on input, or quietly idle.
- 🎯 **Quick navigation** — hover to peek, click to pin open, click a
  card to jump straight to that session.
- 🔔 **Optional chime** when a session finishes and needs your input.
- 🎨 Color language matches
  [`dsh-dingo`](https://github.com/) so the two stay in sync.
- 🌐 Localized: English + Simplified Chinese, auto-switches based on
  Chrome's language.

## Install

The extension **auto-detects any pi dashboard page** by probing its
`/api/sessions` endpoint on load — so it works whether the dashboard
runs on `http://localhost:8000`, an internal IP, or a public tunnel
(FRP, ngrok, Cloudflare, etc.). No manifest edits needed when the
port or hostname changes.

### Option A — load the prebuilt `dist/` (recommended for users)

The repository ships a ready-to-load `dist/` folder. You don't need
Node.js or any build step.

1. **Get the code.** Either:
   - Clone with git:
     ```bash
     git clone https://github.com/february2015/pi-web-dingo.git
     ```
   - Or download a tag from
     [Releases](https://github.com/february2015/pi-web-dingo/releases)
     and unzip it.

2. **Make sure your pi dashboard is running.** The extension only
   activates when it can reach `/api/sessions`. Start the dashboard
   (default: `http://localhost:8000`) before opening it in Chrome.

3. **Open Chrome's extension page.** Navigate to
   `chrome://extensions` in a new tab.

4. **Turn on Developer mode.** Toggle the switch in the top-right
   corner of that page.

5. **Load the unpacked extension.** Click the **Load unpacked**
   button that appears, then select the `dist/` folder inside this
   repo (the one that contains `manifest.json` directly).

6. **Pin the extension.** Click the puzzle-piece icon in the
   Chrome toolbar, then click the pin next to **pi Web Dingo** so
   the pill stays visible across browser restarts.

7. **Open the dashboard.** Navigate to your pi dashboard
   (e.g. `http://localhost:8000`). The pill should appear in the
   top-right within ~1 second. If it doesn't, see
   [Troubleshooting](#troubleshooting) below.

### Option B — build from source (for contributors)

Use this if you're modifying the extension and want your changes
reflected in the loaded `dist/`.

```bash
git clone https://github.com/february2015/pi-web-dingo.git
cd pi-web-dingo
npm install
npm run build
```

Then load `dist/` as in Option A. After every source change, run
`npm run build` again and click the **Reload** icon on
`chrome://extensions` for the extension.

## Usage

- **Hover the pill** → panel opens with a list of sessions, sorted by
  status (most urgent first).
- **Click the pill** → panel stays open ("pinned"). Click again to
  release. Your pin state is remembered across page reloads.
- **Click a card** → jump straight to that session. The panel
  collapses automatically.
- **Drag the pill** → move it anywhere along the right edge of the
  viewport. Position is remembered.

### Status colors

| Bucket | Color | Meaning |
|---|---|---|
| Error | 🔴 red | Session ended in error (last 30s) |
| Question | 🟠 amber | Session needs your input |
| Draft | 🟣 purple | Has unsent input on an off-screen session |
| Answered | 🟢 green | Finished, unread |
| Waiting | 🟢 teal | Background jobs / sub-tasks still running |
| Intermediate | 🔵 cyan | Streaming with output |
| Running | 🔵 blue | Streaming, no output yet |
| Normal | ⚪ grey | Idle and read |

## Project layout

```
pi-web-dingo/
├── dist/                 # Build output (committed; load this into Chrome)
├── icons/                # Source PNGs for the extension toolbar icon
├── public/
│   ├── manifest.json     # MV3 manifest
│   └── _locales/
│       ├── en/messages.json
│       └── zh_CN/messages.json
├── src/
│   ├── client/           # React UI (pill + panel)
│   └── extension/        # Content script + background service worker
├── vite.config.ts        # Vite build + asset copy
└── package.json
```

## Troubleshooting

**Pill doesn't appear on the dashboard.**
Open DevTools on the dashboard tab (F12 → Console), then refresh the
page. If you don't see any `[dingo]` log lines, the content script
didn't load — check `chrome://extensions` for errors and make sure
Developer mode is on. If you see `[dingo] probe ...` followed by
`probe= false`, the dashboard's `/api/sessions` endpoint didn't return
a recognizable shape (HTTP error, HTML login page, or non-JSON
payload). Start the dashboard first, then refresh.

**"Manifest version 3 is not supported" or similar load error.**
You're using an outdated Chrome (MV3 needs Chrome 88+). Update Chrome
or use the pre-1.0 manifest.

**Pill is in the wrong place / hidden behind dashboard UI.**
Drag it anywhere along the right edge of the viewport. Position is
saved per-browser. If the pill is behind a modal, click the
dashboard to dismiss the modal first.

**Updates after `git pull` don't take effect.**
Click the **Reload** icon on `chrome://extensions` for this
extension. Chrome caches the loaded version separately from the file
contents.

**Status counts look stale.**
The extension polls `/api/sessions` every 5 seconds as a fallback. If
counts don't update after a few seconds, open the dashboard in
another tab — the dashboard server itself may be slow to record the
change.

## Development

```bash
npm run dev       # Vite dev server (HMR)
npm run build     # tsc type-check + production build → dist/
npm run preview   # Preview the production build
```

The dev server alone isn't enough — Chrome needs the **built**
`dist/` folder. Always run `npm run build` before reloading the
extension from `chrome://extensions`.

## Configuration

The extension probes `/api/sessions` on every page load to detect the
dashboard, so there is no port or hostname to configure. If the probe
fails (no endpoint, wrong shape, CORS denial), the content script
exits silently and the page is left untouched.

If the dashboard ever moves to a different API path, edit
`probeDashboard()` in `src/extension/content.tsx` and rebuild.

## License

MIT.
