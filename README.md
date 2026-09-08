# CodeNotch for Windows

A small always-on-top widget that pins to a corner of your screen (Windows 11) and shows
how much of each AI coding tool's usage limit you've burned — rings with color coding
(green = plenty left, amber = getting low, red = almost done).

Hover the pill to expand it: every limit window with its percentage, progress bar, and
when it resets. Turn providers on/off, pick a corner, set the poll interval, enable
start-with-Windows — all from the gear.

Inspired by [codenotch](https://github.com/vinzdg/codenotch) (macOS, MIT) — this is the
Windows port of the concept, built with Electron + React + Tailwind.

## What it tracks

| Provider | Source | Shows |
|---|---|---|
| **OpenCode Go** | The `opencode-go` key OpenCode stores on sign-in (or `OPENCODE_GO_API_KEY`) | 5-hour, Weekly, Monthly limits with reset times |
| **Codex** | Your local Codex sign-in at `~/.codex/auth.json` — no separate login | 5-hour (session) + weekly/monthly windows, per plan |

CodeNotch never signs in anywhere. Every reading is borrowed from a credential a tool on
your PC already holds. Adding future providers (Claude Code, Cursor…) means adding one
file under `src/main/providers/` — the ring UI, storage, and polling are provider-agnostic.

## The honest caveat

No vendor publishes a clean "you've used N%" API. Each provider reads the same endpoint
the vendor's own dashboard reads, with credentials the tool already stores. Every failure
degrades to a visible status — **Stale**, **Not signed in**, **Backing off** — never a
made-up percentage. Rate limits (429) trigger an automatic back-off schedule that
survives relaunches.

## Install (plain language)

1. Download `CodeNotch-Setup-1.0.0.exe` from the [Releases page](../../releases)
2. Double-click it. If Windows shows a blue "protected your PC" screen, click
   **More info → Run anyway** (the app isn't code-signed — that's normal for
   self-published free tools; you can read every line of code in this repo)
3. Choose "Anyone" or "Only for me" when asked, then Install
4. The widget appears in the bottom-right corner of your screen

### Give it data

- **Codex ring** appears automatically if you've signed in to Codex on this PC
  (the widget reads `C:\Users\<you>\.codex\auth.json` — it never changes or
  refreshes that file, just reads the token like codenotch does on macOS)
- **OpenCode ring** appears if either:
  - you've run `opencode auth login` and connected your Go plan, **or**
  - the `OPENCODE_GO_API_KEY` environment variable is set on your PC
    (this is how [Hermes Agent](https://github.com/nousresearch/hermes-agent)
    stores it, and the widget finds it there too)

No data source found? The ring shows a red **"Not signed in"** state with a note in the
expanded view — it will never show a fake number.

### Daily use

- **Hover** the pill → it expands into the detail card; move away → collapses
- **Drag** the pill anywhere → it remembers where you left it
- **Gear icon** → settings: turn providers on/off, poll interval, snap to a corner,
  start with Windows, refresh now, quit
- The widget ignores clicks that aren't on it (you can't accidentally click "through"
  its invisible bounding box)

## Building from source

```sh
npm install
npm run dist        # → release/CodeNotch-Setup-1.0.0.exe + portable .exe
npm start           # run unpackaged for development
```

## Project layout

```
src/main/            Electron main process
  index.ts           Window, tray, IPC, auto-start, position persistence
  usage-store.ts     Polling engine + last-good snapshots + backoff (codenotch's UsageStore)
  provider.ts        UsageProvider contract + typed errors + backoff math
  providers/
    opencode.ts      OpenCode Go → opencode.ai/zen/go/v1/usage
    codex.ts         Codex → chatgpt.com/backend-api/wham/usage (local auth.json)
  settings.ts        %APPDATA%/CodeNotch persistence
src/preload/         Context-isolated IPC bridge
src/renderer/        React UI (collapsed pill → hover card → settings)
src/shared/types.ts  Shared contract: snapshots, statuses, settings
```

## Credits

- [vinzdg/codenotch](https://github.com/vinzdg/codenotch) — the original macOS app and
  the source of the provider/endpoint approach, the honest-failure philosophy, and the
  backoff design (MIT). If you're on a Mac, use the original.
- Built by [Forge](https://github.com/Achu1919) for Achu's Windows daily driver.

## License

MIT
