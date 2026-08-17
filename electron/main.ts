import { appendFileSync, copyFileSync, existsSync, mkdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import type { IpcMainInvokeEvent } from "electron";
import { recoverDatabaseFromBackup } from "./database";
import { LedgerClient } from "./ledger-client";
import { isAllowedRendererNavigation } from "./navigation";
import { paletteForTheme } from "../shared/themes";
import type {
  PeriodSelection,
  SaveCategoryInput,
  SaveTransactionInput,
  ThemeName,
  ThemePalette,
  TransactionFilters,
} from "../shared/types";

let mainWindow: BrowserWindow | null = null;
let ledger: LedgerClient | null = null;
let showFallback: NodeJS.Timeout | null = null;
let databaseClosing = false;

function dataDirectory(): string {
  if (process.env.TALLYPINE_DATA_DIR) return process.env.TALLYPINE_DATA_DIR;
  const installedDirectory = join(process.env.LOCALAPPDATA ?? app.getPath("userData"), "Tallypine");
  const portableRoot = process.env.PORTABLE_EXECUTABLE_DIR;
  if (!portableRoot) return installedDirectory;

  const portableDirectory = join(portableRoot, "Tallypine Data");
  mkdirSync(portableDirectory, { recursive: true });
  const portableDatabase = join(portableDirectory, "tallypine.db");
  const installedDatabase = join(installedDirectory, "tallypine.db");
  if (!existsSync(portableDatabase) && existsSync(installedDatabase)) {
    for (const suffix of ["", "-wal", "-shm"]) {
      const source = `${installedDatabase}${suffix}`;
      if (existsSync(source)) copyFileSync(source, `${portableDatabase}${suffix}`);
    }
  }
  return portableDirectory;
}

const ledgerDirectory = dataDirectory();
app.setPath("userData", ledgerDirectory);
const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) app.quit();

function logFailure(context: string, error: unknown): void {
  try {
    const directory = ledgerDirectory;
    mkdirSync(directory, { recursive: true });
    const detail = error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error);
    appendFileSync(join(directory, "tallypine-crash.log"), `[${new Date().toISOString()}] ${context}\n${detail}\n\n`, "utf8");
  } catch {
    // Logging must never turn a recoverable UI error into a crash.
  }
}

function requireLedger(): LedgerClient {
  if (!ledger) throw new Error("Tallypine's local database is not ready.");
  return ledger;
}

function requireWindow(): BrowserWindow {
  if (!mainWindow || mainWindow.isDestroyed()) throw new Error("Tallypine's window is not ready.");
  return mainWindow;
}

function handleIpc(channel: string, listener: (event: IpcMainInvokeEvent, ...args: any[]) => unknown): void {
  ipcMain.handle(channel, (event, ...args) => {
    const window = requireWindow();
    if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) {
      throw new Error("Tallypine blocked an untrusted application request.");
    }
    return listener(event, ...args);
  });
}

function registerIpc(): void {
  handleIpc("app:bootstrap", () => requireLedger().bootstrap(app.getVersion(), ledgerDirectory));
  handleIpc("app:dashboard", (_event, selection: PeriodSelection) => requireLedger().dashboard(selection));
  handleIpc("app:transactions", (_event, filters: TransactionFilters) => requireLedger().transactions(filters));
  handleIpc("app:categories", (_event, includeArchived = false) => requireLedger().categories(Boolean(includeArchived)));
  handleIpc("app:save-transaction", (_event, input: SaveTransactionInput) => requireLedger().saveTransaction(input));
  handleIpc("app:delete-transaction", (_event, id: number) => requireLedger().deleteTransaction(Number(id)));
  handleIpc("app:save-category", (_event, input: SaveCategoryInput) => requireLedger().saveCategory(input));
  handleIpc("app:archive-category", (_event, id: number) => requireLedger().archiveCategory(Number(id)));
  handleIpc("app:set-starting-balance", (_event, value: string) => requireLedger().setStartingBalance(value));
  handleIpc("app:set-currency", (_event, code: string) => requireLedger().setCurrency(code));
  handleIpc("app:set-theme", async (_event, name: ThemeName) => {
    const updated = await requireLedger().setTheme(name);
    requireWindow().setBackgroundColor(paletteForTheme(updated.themeName, updated.customTheme).bg);
    return updated;
  });
  handleIpc("app:save-custom-theme", async (_event, palette: ThemePalette) => {
    const updated = await requireLedger().saveCustomTheme(palette);
    requireWindow().setBackgroundColor(palette.bg);
    return updated;
  });
  handleIpc("app:complete-onboarding", (_event, currency: string, balance: string) => requireLedger().completeOnboarding(currency, balance));
  handleIpc("app:export-csv", async (_event, selection: PeriodSelection) => {
    const range = (await requireLedger().dashboard(selection)).range;
    const result = await dialog.showSaveDialog(requireWindow(), {
      title: "Export Tallypine transactions",
      defaultPath: `Tallypine-${range.label.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "")}.csv`,
      filters: [{ name: "CSV spreadsheet", extensions: ["csv"] }],
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    await writeFile(result.filePath, await requireLedger().exportCsv(selection), "utf8");
    return { canceled: false, message: "Your CSV export was saved." };
  });
  handleIpc("app:create-backup", async () => {
    const result = await dialog.showSaveDialog(requireWindow(), {
      title: "Save Tallypine backup",
      defaultPath: `Tallypine-backup-${new Date().toISOString().slice(0, 10)}.tpbackup`,
      filters: [{ name: "Tallypine backup", extensions: ["tpbackup"] }],
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    await requireLedger().createBackup(result.filePath);
    return { canceled: false, message: "Your complete backup was saved." };
  });
  handleIpc("app:restore-backup", async () => {
    const result = await dialog.showOpenDialog(requireWindow(), {
      title: "Choose a Tallypine backup",
      properties: ["openFile"],
      filters: [
        { name: "Tallypine backup", extensions: ["tpbackup"] },
        { name: "All files", extensions: ["*"] },
      ],
    });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    await requireLedger().restoreBackup(result.filePaths[0]);
    return { canceled: false, message: "Your Tallypine backup was restored." };
  });
  handleIpc("app:renderer-ready", () => {
    if (showFallback) clearTimeout(showFallback);
    showFallback = null;
    const window = requireWindow();
    if (!window.isVisible()) window.show();
  });
  handleIpc("window:minimize", () => requireWindow().minimize());
  handleIpc("window:toggle-maximize", () => {
    const window = requireWindow();
    if (window.isMaximized()) window.unmaximize();
    else window.maximize();
    return window.isMaximized();
  });
  handleIpc("window:set-background", (_event, color: string) => {
    if (!/^#[0-9A-F]{6}$/i.test(color)) throw new Error("Tallypine blocked an invalid window color.");
    requireWindow().setBackgroundColor(color);
  });
  handleIpc("window:close", () => requireWindow().close());
}

async function openLedgerWithRecovery(path: string): Promise<LedgerClient> {
  try {
    const client = new LedgerClient(path);
    await client.ready();
    return client;
  } catch (startupError) {
    logFailure("database open", startupError);
    const choice = await dialog.showMessageBox({
      type: "error",
      title: "Tallypine needs a database backup",
      message: "Tallypine could not safely open your local database.",
      detail: "Your unreadable database will be preserved. You can restore a verified .tpbackup file now or close Tallypine without changing anything.",
      buttons: ["Restore a backup", "Close Tallypine"],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    });
    if (choice.response !== 0) throw startupError;

    const selected = await dialog.showOpenDialog({
      title: "Choose a Tallypine backup",
      properties: ["openFile"],
      filters: [{ name: "Tallypine backup", extensions: ["tpbackup"] }],
    });
    if (selected.canceled || !selected.filePaths[0]) throw startupError;
    const preserved = recoverDatabaseFromBackup(path, selected.filePaths[0]);
    await dialog.showMessageBox({
      type: "info",
      title: "Tallypine database restored",
      message: "Your verified backup was restored successfully.",
      detail: preserved ? `The unreadable database was preserved at:\n${preserved}` : "No previous database file needed to be preserved.",
    });
    const recovered = new LedgerClient(path);
    await recovered.ready();
    return recovered;
  }
}

async function createWindow(): Promise<void> {
  const devRendererUrl = process.env.VITE_DEV_SERVER_URL;
  const packagedRendererUrl = pathToFileURL(join(__dirname, "../../dist/index.html")).href;
  const rendererUrl = devRendererUrl ?? packagedRendererUrl;

  const initialSettings = await requireLedger().settings();
  const initialPalette = paletteForTheme(initialSettings.themeName, initialSettings.customTheme);
  mainWindow = new BrowserWindow({
    title: "Tallypine",
    width: 1320,
    height: 860,
    minWidth: 940,
    minHeight: 680,
    show: false,
    frame: false,
    backgroundColor: initialPalette.bg,
    autoHideMenuBar: true,
    icon: join(__dirname, "../../build/tallypine.ico"),
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      backgroundThrottling: true,
    },
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  mainWindow.webContents.on("did-fail-load", (_event, code, description) => {
    logFailure("renderer failed to load", new Error(`${code}: ${description}`));
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.session.setPermissionCheckHandler(() => false);
  mainWindow.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));

  // The first navigation is the trusted renderer URL selected above. Register the
  // guard only after that load so it cannot cancel Electron's own packaged startup.
  await mainWindow.loadURL(rendererUrl);

  mainWindow.webContents.on("will-navigate", (event, target) => {
    if (!isAllowedRendererNavigation(target, devRendererUrl, packagedRendererUrl)) event.preventDefault();
  });

  showFallback = setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) mainWindow.show();
  }, 6_000);
}

if (singleInstance) {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    try {
      app.setAppUserModelId("com.tallypine.desktop");
      ledger = await openLedgerWithRecovery(join(ledgerDirectory, "tallypine.db"));
      registerIpc();
      await createWindow();
    } catch (error) {
      logFailure("startup", error);
      await dialog.showMessageBox({
        type: "error",
        title: "Tallypine could not start",
        message: "Tallypine could not safely open your local data.",
        detail: error instanceof Error ? error.message : String(error),
      });
      app.quit();
    }
  });

  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", (event) => {
    if (!ledger || databaseClosing) return;
    event.preventDefault();
    databaseClosing = true;
    const client = ledger;
    ledger = null;
    void client.close().catch((error) => logFailure("database close", error)).finally(() => app.quit());
  });

  process.on("uncaughtException", (error) => logFailure("uncaught exception", error));
  process.on("unhandledRejection", (error) => logFailure("unhandled rejection", error));
}
