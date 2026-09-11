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

This extension targets the **pi dashboard running on
`http://localhost:8000`** (or `http://127.0.0.1:8000`). Make sure your
local dashboard is up before installing.

### Option A — load the prebuilt `dist/` (recommended for users)

The repository ships a ready-to-load `dist/` folder.

1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome.
3. Toggle **Developer mode** on (top right).
4. Click **Load unpacked**.
5. Select the `dist/` folder inside this repo.
6. Pin the extension (puzzle-piece icon → pin 🐕) so the pill stays
   visible.

### Option B — build from source (for contributors)

```bash
git clone https://github.com/<you>/pi-web-dingo.git
cd pi-web-dingo
npm install
npm run build
```

Then load `dist/` as in Option A.

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

The extension matches `http://localhost:8000` and
`http://127.0.0.1:8000` by default. To target a different port or
hostname, edit the `matches` and `host_permissions` arrays in
`public/manifest.json` and rebuild.

## License

MIT.
