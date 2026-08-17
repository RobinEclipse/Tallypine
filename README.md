# Tallypine 1.0 — Electron edition

Tallypine is a private, offline Windows transaction tracker. This edition replaces the old Tk/CustomTkinter interface with a single Chromium-rendered Electron window, while keeping the existing SQLite database format.

## What stays the same

- No login, cloud service, analytics, or internet connection.
- Installed builds keep data in `%LOCALAPPDATA%\Tallypine\tallypine.db`. The portable build keeps `Tallypine Data` beside its EXE and copies existing installed data there on first launch.
- Starting balance, transactions, categories, reports, currencies, themes, CSV export, and `.tpbackup` backups are preserved.
- Dates begin at 2026 and future dates remain blocked.
- The product and data version remain Tallypine 1.0.

Before opening an existing database for the first time, this edition creates:

`%LOCALAPPDATA%\Tallypine\tallypine.db.pre-electron-1.0.tpbackup`

## Why the interface is smoother

Dashboard, Settings, and Currency are mounted inside one renderer and kept ready. Navigation uses a compositor-driven CSS curtain and opacity fade; it does not create or animate extra Windows windows. Themes update CSS color variables without rebuilding controls. The custom title bar uses Electron's supported draggable region.

The application window is hidden until the database, theme, logo, and initial interface are ready.

## Edit and run the source

Requirements: Windows, Node.js 22 or newer, and npm.

```powershell
npm install
npm run dev
```

The main source areas are:

- `src/` — React interface, charts, themes, transitions, and screens.
- `electron/` — secure window shell, IPC, local SQLite data, exports, and backups.
- `shared/` — TypeScript types, currency catalog, and built-in palettes.
- `tests/` — amount, reporting, transaction, theme, and backup tests.

Editing source does not change an existing EXE. Rebuild after editing:

```powershell
.\build.ps1
```

Or run the individual commands:

```powershell
npm run typecheck
npm test
npm run package
```

## Output files

- `release-electron\Tallypine-Setup-1.0.0.exe` — normal Windows installer.
- `release-electron\Tallypine-Portable-1.0.0.exe` — portable executable.

The app uses Electron's secure defaults: context isolation, a sandboxed renderer, no Node integration in the webpage, local packaged content, a restrictive content security policy, trusted-sender checks, and a narrow typed preload API.

Release builds are ready for Electron Builder's Windows code-signing environment variables. A real publisher signature requires a certificate issued to the person or organization distributing Tallypine; unsigned local builds will still trigger Windows publisher warnings.
