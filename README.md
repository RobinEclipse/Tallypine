# Tallypine

Tallypine is a private, offline Windows desktop app for tracking the money you receive and spend.

**Tallypine 1.0.0 is the first public release and the current latest release.**

## What Tallypine does

- Track Money In and Money Out transactions.
- Keep an always-current balance from your starting balance and transactions.
- Review spending by week, month, year, or all time.
- See spending by category and balance over time charts.
- Choose from a full currency list, with currency name and country included.
- Create, edit, archive, and organize transaction categories.
- Export reports as CSV files and create complete local backups.
- Choose Eclipse, Cozy, Sunshine, or build a detailed custom theme.

## Download and use

Get the current installer or portable app from the [latest release](../../releases/latest).

- **Installer:** installs Tallypine normally on Windows.
- **Portable:** runs without installation and keeps its app data in a `Tallypine Data` folder beside the EXE.

When Tallypine opens for the first time, it asks for your display currency and starting balance. No account or login is required.

## Your data and privacy

- Tallypine works offline after installation.
- Your transactions, settings, themes, and backups stay on your PC.
- There is no login, cloud sync, analytics, or advertising.
- Installed builds store their data in `%LOCALAPPDATA%\Tallypine`.
- Local files use your Windows account permissions. They are not password-encrypted.

## Build from source

Requirements: Windows, Node.js 22 or newer, and npm.

```powershell
npm ci
npm run dev
```

To build the installer and portable EXE:

```powershell
.\build.ps1
```

The generated files are placed in `release-electron` and copied to the workspace output folder.

## Development transparency

Tallypine was created with help from AI-assisted development tools. The project owner reviews and controls the code, releases, and product decisions.

## License

Tallypine is available under the [MIT License](LICENSE).
