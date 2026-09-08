# HANDOFF — CodeNotch for Windows

Continuation doc for the next Claude/Forge session. Read this before touching code.

## What this is

Windows port of [vinzdg/codenotch](https://github.com/vinzdg/codenotch) (macOS, MIT):
always-on-top usage widget for AI coding tools. Electron 33 + React 18 + Tailwind 3 +
TypeScript. Ships as NSIS installer + portable exe via electron-builder.

## State (v1.0.0 shipped 2026-09-08)

- Both providers verified against LIVE endpoints from this machine:
  - OpenCode Go → `GET https://opencode.ai/zen/go/v1/usage` (Bearer). Credential chain:
    `~/.local/share/opencode/auth.json` → `OPENCODE_GO_API_KEY` env → Hermes forge
    profile `.env` (that's where it resolves on this PC).
  - Codex → `GET https://chatgpt.com/backend-api/wham/usage` with Bearer + 
    `ChatGPT-Account-Id` from `~/.codex/auth.json` tokens. Response: `rate_limit.primary_window`
    (here: 30d monthly window, plan "go") + optional `secondary_window`. Labels derived
    from `limit_window_seconds` (codenotch's logic).
- Architecture ported from codenotch sources: `UsageProvider` contract, typed
  `UsageProviderError`, `UsageStore` (poll/backoff/persist, last-good-kept, failures
  degrade to `stale|needsAuth|error|rateLimited|nothingMetered` — NEVER fake numbers).
  429 backoff: 60s floor doubling to 15min cap, persisted across relaunch.
- UI: fixed 400×280 transparent overlay window; card anchored bottom-right; collapsed
  pill (fit-content) → hover expands in place. `setIgnoreMouseEvents(ignore, {forward:true})`
  makes everything outside the card click-through; root onMouseMove decides inside/outside.
  **Do NOT resize the window on hover** — causes flicker loops (tried, reverted).
  Drag anywhere on card (WebkitAppRegion drag); position persists to window.json.
- Settings: providers on/off, poll interval (60/300/900/1800s), corner snap,
  start-with-Windows (`app.setLoginItemSettings`, Run key under the hood), quit.
  Stored in `%APPDATA%/CodeNotch/settings.json`; usage state in `state.json`.

## Verified E2E (real runs, 2026-09-08)

- `node scripts/smoke-test.cjs` — both providers, live data (secrets never printed)
- `node scripts/e2e-test.cjs <name> [click]` — CDP-driven: real mouse hover expands
  pill → card; gear click opens settings. Requires app started with
  `--remote-debugging-port=9333`. Screenshots land as `e2e-<name>-*.png`.
- Packaged exe verified: `release/win-unpacked/CodeNotch.exe` with port 9334 +
  `node scripts/verify-packaged.cjs` → both providers `ok` with live percentages.

## Gotchas learned

- `taskkill //IM` fails in this MSYS bash (flag mangling) and `Stop-Process -Force`
  needs approval — prefer **graceful quit via CDP** (`scripts/quit-via-cdp.cjs`,
  `scripts/quit-packaged.cjs`); the app exposes `notch.quit()` IPC for exactly this.
- Single-instance lock: a second launch just exits silently — check for survivors
  before assuming a relaunch showed the new build.
- The window capture via computer_use needs `app='electron'` (dev) or `app='CodeNotch'`
  (packaged), never the productName for the dev build.
- Hover-expansion via synthetic computer_use clicks doesn't work (no real mousemove);
  use CDP `Input.dispatchMouseEvent` (scripts/e2e-test.cjs does).
- electron-builder NSIS: `--remote-debugging-port` passes through fine for testing.

## Ideas backlog

- Claude Code provider (codenotch reads keychain OAuth token + `/usage` endpoint —
  Windows equivalent: `%USERPROFILE%\.claude\` credentials, needs research)
- Tray icon + "hide pill entirely" mode; single-click "refresh all"; tooltip on ring
  hover in collapsed state; light theme (types already carry `theme`)
- Auto-update via electron-updater + GitHub releases (NSIS target already supports it)
