import {
  copyFileSync,
  existsSync,
  mkdirSync,
  renameSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { CURRENCY_CODES } from "../shared/currencies";
import { currencyFractionDigits, displayFractionDigits, MONEY_SCALE, MONEY_SCALE_DIGITS } from "../shared/money";
import { DEFAULT_THEME, THEMES } from "../shared/themes";
import type {
  AppSettings,
  BalancePoint,
  BootstrapData,
  Category,
  CategorySpending,
  DashboardData,
  DateRange,
  LedgerTransaction,
  PeriodSelection,
  SaveCategoryInput,
  SaveTransactionInput,
  Summary,
  ThemeName,
  ThemePalette,
  TransactionFilters,
  TransactionKind,
  TransactionPage,
} from "../shared/types";

export const MIN_YEAR = 2026;
export const SCHEMA_VERSION = 2;
const MAX_AMOUNT_UNITS = 9_999_999_999_999;
const MAX_NOTES_LENGTH = 2_000;
const MAX_BACKUP_BYTES = 512 * 1024 * 1024;
const HEX_COLOR = /^#[0-9A-F]{6}$/i;
const PALETTE_COLOR_KEYS: Array<keyof Omit<ThemePalette, "mode">> = [
  "bg", "surface", "surfaceAlt", "border", "text", "muted", "accent", "accentHover", "green", "red", "amber",
];
const THEME_NAMES = new Set<ThemeName>([
  "Eclipse",
  "Cozy",
  "Sunshine",
  "Custom",
]);

const DEFAULT_CATEGORIES: Array<[string, TransactionKind, string]> = [
  ["Groceries", "EXPENSE", "#F97316"],
  ["Dining out", "EXPENSE", "#EF4444"],
  ["Transport", "EXPENSE", "#38BDF8"],
  ["Housing", "EXPENSE", "#8B5CF6"],
  ["Subscriptions", "EXPENSE", "#EC4899"],
  ["Utilities", "EXPENSE", "#EAB308"],
  ["Shopping", "EXPENSE", "#14B8A6"],
  ["Health", "EXPENSE", "#22C55E"],
  ["Entertainment", "EXPENSE", "#A855F7"],
  ["Other expense", "EXPENSE", "#94A3B8"],
  ["Salary", "INCOME", "#22C55E"],
  ["Refund", "INCOME", "#10B981"],
  ["Gift", "INCOME", "#2DD4BF"],
  ["Other income", "INCOME", "#60A5FA"],
];

type SqlValue = string | number | bigint | null;
type Row = Record<string, SqlValue>;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function localDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error("Use the date format YYYY-MM-DD.");
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (
    date.getFullYear() !== Number(match[1]) ||
    date.getMonth() !== Number(match[2]) - 1 ||
    date.getDate() !== Number(match[3])
  ) {
    throw new Error("Use a real calendar date.");
  }
  return date;
}

function isoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function isoWeekNumber(value: Date): number {
  const date = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const day = date.getDay() || 7;
  date.setDate(date.getDate() + 4 - day);
  const yearStart = new Date(date.getFullYear(), 0, 1);
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

function isoWeekYear(value: Date): number {
  const date = new Date(value);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() + 4 - day);
  return date.getFullYear();
}

function mondayOfIsoWeek(year: number, week: number): Date {
  const fourth = new Date(year, 0, 4);
  const fourthDay = fourth.getDay() || 7;
  return addDays(fourth, -(fourthDay - 1) + (week - 1) * 7);
}

export function availableYears(period: "week" | "month" | "year", today = localToday()): number[] {
  const date = localDate(today);
  const maximum = period === "week" ? isoWeekYear(date) : date.getFullYear();
  return Array.from({ length: Math.max(0, maximum - MIN_YEAR + 1) }, (_, index) => maximum - index);
}

export function availableMonths(year: number, today = localToday()): number[] {
  const current = localDate(today);
  if (year < MIN_YEAR || year > current.getFullYear()) return [];
  const maximum = year === current.getFullYear() ? current.getMonth() + 1 : 12;
  return Array.from({ length: maximum }, (_, index) => index + 1);
}

export function availableWeeks(year: number, today = localToday()): number[] {
  const current = localDate(today);
  const currentYear = isoWeekYear(current);
  if (year < MIN_YEAR || year > currentYear) return [];
  const totalWeeks = isoWeekNumber(new Date(year, 11, 28));
  const maximum = year === currentYear ? isoWeekNumber(current) : totalWeeks;
  return Array.from({ length: maximum }, (_, index) => index + 1);
}

export function selectionToRange(selection: PeriodSelection, today = localToday()): DateRange {
  const current = localDate(today);
  if (selection.period === "all") {
    return { start: `${MIN_YEAR}-01-01`, end: today, label: "All time" };
  }
  const year = selection.year;
  if (!year) throw new Error("Choose a reporting year.");
  if (selection.period === "year") {
    if (!availableYears("year", today).includes(year)) throw new Error("Choose an available year.");
    const end = year === current.getFullYear() ? today : `${year}-12-31`;
    return { start: `${year}-01-01`, end, label: String(year) };
  }
  if (selection.period === "month") {
    const month = selection.month;
    if (!month || !availableMonths(year, today).includes(month)) throw new Error("Choose an available month.");
    const startDate = new Date(year, month - 1, 1);
    const finalDay = new Date(year, month, 0);
    const end = year === current.getFullYear() && month === current.getMonth() + 1 ? today : isoDate(finalDay);
    return {
      start: isoDate(startDate),
      end,
      label: startDate.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    };
  }
  const week = selection.week;
  if (!week || !availableWeeks(year, today).includes(week)) throw new Error("Choose an available week.");
  const weekStart = mondayOfIsoWeek(year, week);
  const startDate = weekStart < localDate(`${MIN_YEAR}-01-01`) ? localDate(`${MIN_YEAR}-01-01`) : weekStart;
  const fullEnd = addDays(weekStart, 6);
  const endDate = fullEnd > current ? current : fullEnd;
  const dateLabel = `${startDate.toLocaleDateString("en-US", { day: "2-digit", month: "short" })}–${fullEnd.toLocaleDateString("en-US", { day: "2-digit", month: "short" })}`;
  return { start: isoDate(startDate), end: isoDate(endDate), label: `Week ${week}, ${year} · ${dateLabel}` };
}

export function parseAmount(value: string, signed = false, fractionDigits = 2): number {
  let normalized = value.trim().replace(/\s/g, "").replace(/NOK|kr/gi, "");
  if (!normalized) throw new Error(signed ? "Enter a starting balance." : "Enter an amount.");
  if (normalized.includes(",") && normalized.includes(".")) {
    normalized = normalized.lastIndexOf(",") > normalized.lastIndexOf(".")
      ? normalized.replace(/\./g, "").replace(",", ".")
      : normalized.replace(/,/g, "");
  } else {
    normalized = normalized.replace(",", ".");
  }
  const match = /^([+-]?)(\d+)(?:\.(\d*))?$/.exec(normalized);
  if (!match) throw new Error(signed ? "Enter a valid starting balance." : "Enter a valid amount, for example 249.90.");
  const negative = match[1] === "-";
  if (!signed && (negative || match[1] === "+")) throw new Error("The amount must be greater than zero.");
  const rawFraction = match[3] ?? "";
  const allowedDigits = Math.max(0, Math.min(MONEY_SCALE_DIGITS, fractionDigits));
  if (/[^0]/.test(rawFraction.slice(allowedDigits))) {
    const unitLabel = allowedDigits === 1 ? "decimal place" : "decimal places";
    throw new Error(`This currency supports ${allowedDigits} ${unitLabel}.`);
  }
  const fraction = rawFraction.padEnd(MONEY_SCALE_DIGITS, "0").slice(0, MONEY_SCALE_DIGITS);
  let amount = BigInt(match[2]) * BigInt(MONEY_SCALE) + BigInt(fraction || "0");
  if (negative) amount = -amount;
  if (amount > BigInt(MAX_AMOUNT_UNITS) || amount < -BigInt(MAX_AMOUNT_UNITS)) throw new Error("That amount is too large.");
  if (!signed && amount <= 0n) throw new Error("The amount must be greater than zero.");
  return Number(amount);
}

function validateDate(value: string, today = localToday()): string {
  const parsed = localDate(value);
  if (value > today) throw new Error("Future-dated transactions are not allowed.");
  if (parsed.getFullYear() < MIN_YEAR) throw new Error(`Choose a date from ${MIN_YEAR} or later.`);
  return isoDate(parsed);
}

function toCustomStorage(palette: ThemePalette): Record<string, string> {
  return {
    mode: palette.mode,
    bg: palette.bg,
    surface: palette.surface,
    surface_alt: palette.surfaceAlt,
    border: palette.border,
    text: palette.text,
    muted: palette.muted,
    accent: palette.accent,
    accent_hover: palette.accentHover,
    green: palette.green,
    red: palette.red,
    amber: palette.amber,
  };
}

function parseCustomTheme(value: string | null): ThemePalette | null {
  if (!value) return null;
  try {
    const raw = JSON.parse(value) as Record<string, unknown>;
    const palette: ThemePalette = {
      mode: raw.mode === "light" ? "light" : "dark",
      bg: String(raw.bg ?? ""),
      surface: String(raw.surface ?? ""),
      surfaceAlt: String(raw.surfaceAlt ?? raw.surface_alt ?? ""),
      border: String(raw.border ?? ""),
      text: String(raw.text ?? ""),
      muted: String(raw.muted ?? ""),
      accent: String(raw.accent ?? ""),
      accentHover: String(raw.accentHover ?? raw.accent_hover ?? ""),
      green: String(raw.green ?? ""),
      red: String(raw.red ?? ""),
      amber: String(raw.amber ?? ""),
    };
    return validatePalette(palette);
  } catch {
    return null;
  }
}

function validatePalette(palette: ThemePalette): ThemePalette {
  if (!palette || typeof palette !== "object") throw new Error("Choose a valid custom theme.");
  if (palette.mode !== "dark" && palette.mode !== "light") throw new Error("Choose a light or dark custom theme.");
  for (const role of PALETTE_COLOR_KEYS) {
    if (!HEX_COLOR.test(String(palette[role] ?? ""))) throw new Error(`Choose a valid color for ${role}.`);
  }
  return { ...palette };
}

function positiveId(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`Choose a valid ${label}.`);
  return value;
}

function escapeLike(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function spreadsheetSafe(value: string): string {
  return /^[\t\r\n ]*[=+\-@]/.test(value) ? `'${value}` : value;
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function databaseColumns(database: DatabaseSync, table: string): Set<string> {
  const rows = database.prepare(`PRAGMA table_info(${table})`).all() as Row[];
  return new Set(rows.map((row) => String(row.name)));
}

function requireColumns(database: DatabaseSync, table: string, required: string[]): Set<string> {
  const columns = databaseColumns(database, table);
  for (const column of required) {
    if (!columns.has(column)) throw new Error(`That backup is missing ${table}.${column}.`);
  }
  return columns;
}

function validateLedgerDatabase(database: DatabaseSync): "amount_units" | "amount_ore" {
  const integrity = database.prepare("PRAGMA quick_check").get() as Row | undefined;
  if (!integrity || String(integrity.quick_check) !== "ok") throw new Error("That file is not a healthy Tallypine backup.");

  const tables = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Row[];
  const names = new Set(tables.map((row) => String(row.name)));
  for (const required of ["settings", "categories", "transactions"]) {
    if (!names.has(required)) throw new Error("That file is not a Tallypine backup.");
  }

  requireColumns(database, "settings", ["key", "value"]);
  requireColumns(database, "categories", ["id", "name", "kind", "color", "active"]);
  const transactionColumns = requireColumns(database, "transactions", [
    "id", "transaction_date", "kind", "category_id", "description", "notes", "created_at", "updated_at",
  ]);
  const amountColumn = transactionColumns.has("amount_units")
    ? "amount_units"
    : transactionColumns.has("amount_ore")
      ? "amount_ore"
      : null;
  if (!amountColumn) throw new Error("That backup is missing transaction amounts.");

  const invalidCategory = database.prepare(
    "SELECT 1 FROM categories WHERE kind NOT IN ('INCOME', 'EXPENSE') OR active NOT IN (0, 1) OR name IS NULL OR color IS NULL LIMIT 1",
  ).get() as Row | undefined;
  if (invalidCategory) throw new Error("That backup contains invalid category data.");
  const invalidTransaction = database.prepare(
    `SELECT 1 FROM transactions WHERE kind NOT IN ('INCOME', 'EXPENSE') OR ${amountColumn} <= 0
      OR transaction_date < '${MIN_YEAR}-01-01' OR length(transaction_date) <> 10 OR date(transaction_date) IS NULL
      OR description IS NULL OR notes IS NULL LIMIT 1`,
  ).get() as Row | undefined;
  if (invalidTransaction) throw new Error("That backup contains invalid transaction data.");
  const foreignKeyProblems = database.prepare("PRAGMA foreign_key_check").all() as Row[];
  if (foreignKeyProblems.length) throw new Error("That backup contains broken category references.");

  database.prepare(`
    SELECT t.id, t.transaction_date, t.kind, t.${amountColumn}, t.category_id, t.description, t.notes,
      COALESCE(c.name, 'Archived category') AS category_name
    FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
    ORDER BY t.transaction_date DESC, t.id DESC LIMIT 1
  `).get();
  database.prepare("SELECT key, value FROM settings ORDER BY key LIMIT 1").get();
  return amountColumn;
}

function timestampForFilename(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function validateBackupPath(source: string): void {
  if (!existsSync(source)) throw new Error("That backup file does not exist.");
  if (statSync(source).size > MAX_BACKUP_BYTES) throw new Error("That backup is too large for Tallypine to restore safely.");
  const database = new DatabaseSync(source, { readOnly: true, timeout: 5_000 });
  try {
    validateLedgerDatabase(database);
  } finally {
    database.close();
  }
}

export class LedgerDatabase {
  readonly path: string;
  private database: DatabaseSync;

  constructor(path: string) {
    this.path = path;
    mkdirSync(dirname(path), { recursive: true });
    const existed = existsSync(path);
    this.database = this.open();
    try {
      if (existed) this.createPreElectronBackup();
      this.initialize();
    } catch (error) {
      try { this.database.close(); } catch { /* The failed open may already be closed. */ }
      throw error;
    }
  }

  private open(): DatabaseSync {
    const database = new DatabaseSync(this.path, { timeout: 5_000 });
    database.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;");
    return database;
  }

  private initialize(): void {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL COLLATE NOCASE,
        kind TEXT NOT NULL CHECK (kind IN ('INCOME', 'EXPENSE')),
        color TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
        UNIQUE(name, kind)
      );
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_date TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('INCOME', 'EXPENSE')),
        amount_units INTEGER NOT NULL CHECK (amount_units > 0),
        category_id INTEGER,
        description TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(category_id) REFERENCES categories(id)
      );
    `);

    this.migrateMoneyScale();
    this.database.exec(`
      CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
      CREATE INDEX IF NOT EXISTS idx_transactions_date_id ON transactions(transaction_date DESC, id DESC);
      CREATE INDEX IF NOT EXISTS idx_transactions_kind_date_id ON transactions(kind, transaction_date DESC, id DESC);
    `);

    if (this.getSetting("starting_balance_units") === null) {
      const oldBalance = Number.parseInt(this.getSetting("starting_balance_ore") ?? "0", 10);
      this.setSetting("starting_balance_units", String((Number.isSafeInteger(oldBalance) ? oldBalance : 0) * 100));
    }
    const defaults: Array<[string, string]> = [
      ["starting_balance_units", "0"],
      ["currency_code", "NOK"],
      ["theme_name", DEFAULT_THEME],
      ["onboarding_complete", "0"],
      ["schema_version", String(SCHEMA_VERSION)],
    ];
    const insertSetting = this.database.prepare("INSERT OR IGNORE INTO settings(key, value) VALUES(?, ?)");
    for (const row of defaults) insertSetting.run(...row);
    const insertCategory = this.database.prepare("INSERT OR IGNORE INTO categories(name, kind, color) VALUES(?, ?, ?)");
    for (const row of DEFAULT_CATEGORIES) insertCategory.run(...row);
    this.setSetting("schema_version", String(SCHEMA_VERSION));
  }

  private migrateMoneyScale(): void {
    const columns = this.database.prepare("PRAGMA table_info(transactions)").all() as Row[];
    const names = new Set(columns.map((row) => String(row.name)));
    if (names.has("amount_units")) return;
    if (!names.has("amount_ore")) throw new Error("This Tallypine database has an unsupported transaction schema.");

    const migrationBackup = `${this.path}.pre-schema-${SCHEMA_VERSION}.tpbackup`;
    if (!existsSync(migrationBackup)) {
      this.database.exec("PRAGMA wal_checkpoint(TRUNCATE)");
      copyFileSync(this.path, migrationBackup, 1);
    }

    this.database.exec("PRAGMA foreign_keys = OFF");
    this.database.exec("BEGIN IMMEDIATE");
    try {
      this.database.exec(`
        ALTER TABLE transactions RENAME TO transactions_legacy_money;
        DROP INDEX IF EXISTS idx_transactions_date;
        DROP INDEX IF EXISTS idx_transactions_date_id;
        DROP INDEX IF EXISTS idx_transactions_kind_date_id;
        CREATE TABLE transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          transaction_date TEXT NOT NULL,
          kind TEXT NOT NULL CHECK (kind IN ('INCOME', 'EXPENSE')),
          amount_units INTEGER NOT NULL CHECK (amount_units > 0),
          category_id INTEGER,
          description TEXT NOT NULL,
          notes TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY(category_id) REFERENCES categories(id)
        );
        INSERT INTO transactions(id, transaction_date, kind, amount_units, category_id, description, notes, created_at, updated_at)
          SELECT id, transaction_date, kind, amount_ore * 100, category_id, description, notes, created_at, updated_at
          FROM transactions_legacy_money;
        DROP TABLE transactions_legacy_money;
      `);
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    } finally {
      this.database.exec("PRAGMA foreign_keys = ON");
    }
  }

  private createPreElectronBackup(): void {
    const backup = `${this.path}.pre-electron-1.0.tpbackup`;
    if (existsSync(backup)) return;
    const check = this.database.prepare("PRAGMA quick_check").get() as Row | undefined;
    if (!check || String(check.quick_check) !== "ok") throw new Error("Your existing Tallypine database did not pass its safety check.");
    this.database.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    copyFileSync(this.path, backup, 1);
  }

  close(): void {
    this.database.close();
  }

  private getSetting(key: string): string | null {
    const row = this.database.prepare("SELECT value FROM settings WHERE key = ?").get(key) as Row | undefined;
    return row ? String(row.value) : null;
  }

  private setSetting(key: string, value: string): void {
    this.database.prepare(
      "INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    ).run(key, value);
  }

  settings(): AppSettings {
    const balance = Number.parseInt(this.getSetting("starting_balance_units") ?? "0", 10);
    const currency = (this.getSetting("currency_code") ?? "NOK").toUpperCase();
    const theme = this.getSetting("theme_name") as ThemeName | null;
    return {
      startingBalanceUnits: Number.isSafeInteger(balance) ? balance : 0,
      currencyCode: CURRENCY_CODES.has(currency) ? currency : "NOK",
      themeName: theme && THEME_NAMES.has(theme) ? theme : DEFAULT_THEME,
      customTheme: parseCustomTheme(this.getSetting("custom_theme_json")),
      onboardingComplete: this.getSetting("onboarding_complete") === "1",
    };
  }

  bootstrap(version: string, storageDirectory = dirname(this.path)): BootstrapData {
    return {
      settings: this.settings(),
      categories: this.categories(false),
      today: localToday(),
      minYear: MIN_YEAR,
      version,
      storageDirectory,
    };
  }

  setStartingBalance(value: string): AppSettings {
    const digits = currencyFractionDigits(this.settings().currencyCode);
    this.setSetting("starting_balance_units", String(parseAmount(value, true, digits)));
    return this.settings();
  }

  setCurrency(value: string): AppSettings {
    const code = value.trim().toUpperCase();
    if (!CURRENCY_CODES.has(code)) throw new Error("Choose a supported currency code.");
    this.setSetting("currency_code", code);
    return this.settings();
  }

  setTheme(value: ThemeName): AppSettings {
    if (!THEME_NAMES.has(value)) throw new Error("Choose a supported Tallypine theme.");
    this.setSetting("theme_name", value);
    return this.settings();
  }

  saveCustomTheme(value: ThemePalette): AppSettings {
    const palette = validatePalette(value);
    this.database.exec("BEGIN IMMEDIATE");
    try {
      this.setSetting("custom_theme_json", JSON.stringify(toCustomStorage(palette)));
      this.setSetting("theme_name", "Custom");
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
    return this.settings();
  }

  completeOnboarding(currency: string, startingBalance: string): AppSettings {
    const code = currency.trim().toUpperCase();
    if (!CURRENCY_CODES.has(code)) throw new Error("Choose a supported currency code.");
    const balance = parseAmount(startingBalance, true, currencyFractionDigits(code));
    this.database.exec("BEGIN IMMEDIATE");
    try {
      this.setSetting("currency_code", code);
      this.setSetting("starting_balance_units", String(balance));
      this.setSetting("onboarding_complete", "1");
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
    return this.settings();
  }

  categories(includeArchived = false): Category[] {
    const rows = this.database.prepare(
      `SELECT id, name, kind, color, active FROM categories ${includeArchived ? "" : "WHERE active = 1"} ORDER BY name COLLATE NOCASE`,
    ).all() as Row[];
    return rows.map((row) => ({
      id: Number(row.id),
      name: String(row.name),
      kind: String(row.kind) as TransactionKind,
      color: String(row.color),
      active: Number(row.active) === 1,
    }));
  }

  saveCategory(input: SaveCategoryInput): number {
    if (!input || typeof input !== "object") throw new Error("Enter valid category details.");
    const categoryId = input.id === undefined ? undefined : positiveId(Number(input.id), "category");
    const name = input.name.trim();
    if (!name) throw new Error("Enter a category name.");
    if (name.length > 40) throw new Error("Category names can contain up to 40 characters.");
    if (input.kind !== "INCOME" && input.kind !== "EXPENSE") throw new Error("Choose Money In or Money Out.");
    if (!HEX_COLOR.test(input.color)) throw new Error("Choose a valid category color.");
    try {
      if (categoryId) {
        const current = this.database.prepare("SELECT kind FROM categories WHERE id = ?").get(categoryId) as Row | undefined;
        if (!current) throw new Error("That category no longer exists.");
        if (current.kind !== input.kind) throw new Error("A category's transaction type cannot be changed after creation.");
        const result = this.database.prepare("UPDATE categories SET name = ?, color = ? WHERE id = ?").run(name, input.color, categoryId);
        if (Number(result.changes) !== 1) throw new Error("That category no longer exists.");
        return categoryId;
      }
      const archived = this.database.prepare("SELECT id, active FROM categories WHERE name = ? AND kind = ?").get(name, input.kind) as Row | undefined;
      if (archived) {
        if (Number(archived.active) === 0) {
          this.database.prepare("UPDATE categories SET active = 1, color = ? WHERE id = ?").run(input.color, archived.id);
          return Number(archived.id);
        }
        throw new Error("That category already exists.");
      }
      const result = this.database.prepare("INSERT INTO categories(name, kind, color) VALUES(?, ?, ?)").run(name, input.kind, input.color);
      return Number(result.lastInsertRowid);
    } catch (error) {
      if (error instanceof Error && /UNIQUE/i.test(error.message)) throw new Error("That category name is already in use.");
      throw error;
    }
  }

  archiveCategory(id: number): void {
    id = positiveId(id, "category");
    const row = this.database.prepare("SELECT kind FROM categories WHERE id = ?").get(id) as Row | undefined;
    if (!row) return;
    const count = this.database.prepare("SELECT COUNT(*) AS count FROM categories WHERE kind = ? AND active = 1").get(row.kind) as Row;
    if (Number(count.count) <= 1) throw new Error("Keep at least one active category for each transaction type.");
    this.database.prepare("UPDATE categories SET active = 0 WHERE id = ?").run(id);
  }

  saveTransaction(input: SaveTransactionInput): number {
    if (!input || typeof input !== "object") throw new Error("Enter valid transaction details.");
    const categoryId = positiveId(Number(input.categoryId), "category");
    const transactionId = input.id === undefined ? undefined : positiveId(Number(input.id), "transaction");
    const transactionDate = validateDate(input.transactionDate);
    if (input.kind !== "INCOME" && input.kind !== "EXPENSE") throw new Error("Choose Money In or Money Out.");
    const amountUnits = parseAmount(input.amount, false, currencyFractionDigits(this.settings().currencyCode));
    const description = input.description.trim();
    const notes = input.notes.trim();
    if (!description) throw new Error("Enter a description.");
    if (description.length > 120) throw new Error("Descriptions can contain up to 120 characters.");
    if (notes.length > MAX_NOTES_LENGTH) throw new Error(`Notes can contain up to ${MAX_NOTES_LENGTH.toLocaleString()} characters.`);
    const category = this.database.prepare("SELECT id, kind, active FROM categories WHERE id = ?").get(categoryId) as Row | undefined;
    if (!category || category.kind !== input.kind) throw new Error("Choose a category that matches the transaction type.");
    if (Number(category.active) !== 1) {
      const existing = transactionId
        ? this.database.prepare("SELECT category_id FROM transactions WHERE id = ?").get(transactionId) as Row | undefined
        : undefined;
      if (!existing || Number(existing.category_id) !== categoryId) {
        throw new Error("Choose an active category for this transaction.");
      }
    }
    const now = new Date().toISOString();
    if (transactionId) {
      const result = this.database.prepare(`
        UPDATE transactions SET transaction_date = ?, kind = ?, amount_units = ?, category_id = ?,
          description = ?, notes = ?, updated_at = ? WHERE id = ?
      `).run(transactionDate, input.kind, amountUnits, categoryId, description, notes, now, transactionId);
      if (Number(result.changes) !== 1) throw new Error("That transaction no longer exists.");
      return transactionId;
    }
    const result = this.database.prepare(`
      INSERT INTO transactions(transaction_date, kind, amount_units, category_id, description, notes, created_at, updated_at)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?)
    `).run(transactionDate, input.kind, amountUnits, categoryId, description, notes, now, now);
    return Number(result.lastInsertRowid);
  }

  deleteTransaction(id: number): void {
    id = positiveId(id, "transaction");
    const result = this.database.prepare("DELETE FROM transactions WHERE id = ?").run(id);
    if (Number(result.changes) !== 1) throw new Error("That transaction no longer exists.");
  }

  private filters(filters: Pick<TransactionFilters, "selection" | "search" | "kind">): { where: string; values: SqlValue[] } {
    const range = selectionToRange(filters.selection);
    const clauses = ["t.transaction_date BETWEEN ? AND ?"];
    const values: SqlValue[] = [range.start, range.end];
    if (filters.search.trim()) {
      const needle = `%${escapeLike(filters.search.trim())}%`;
      clauses.push("(t.description LIKE ? ESCAPE '\\' OR t.notes LIKE ? ESCAPE '\\' OR c.name LIKE ? ESCAPE '\\')");
      values.push(needle, needle, needle);
    }
    if (filters.kind === "INCOME" || filters.kind === "EXPENSE") {
      clauses.push("t.kind = ?");
      values.push(filters.kind);
    }
    return { where: `WHERE ${clauses.join(" AND ")}`, values };
  }

  transactions(filters: TransactionFilters): TransactionPage {
    if (!filters || typeof filters !== "object") throw new Error("Choose valid transaction filters.");
    const requestedSize = Number(filters.pageSize);
    const requestedIndex = Number(filters.page);
    const pageSize = Number.isFinite(requestedSize) ? Math.min(100, Math.max(1, Math.trunc(requestedSize))) : 20;
    const requestedPage = Number.isFinite(requestedIndex) ? Math.max(0, Math.trunc(requestedIndex)) : 0;
    const { where, values } = this.filters(filters);
    const countRow = this.database.prepare(`SELECT COUNT(*) AS count FROM transactions t LEFT JOIN categories c ON c.id = t.category_id ${where}`).get(...values) as Row;
    const total = Number(countRow.count);
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(requestedPage, pageCount - 1);
    const rows = this.database.prepare(`
      SELECT t.*, COALESCE(c.name, 'Archived category') AS category_name,
        COALESCE(c.color, '#94A3B8') AS category_color
      FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
      ${where} ORDER BY t.transaction_date DESC, t.id DESC LIMIT ? OFFSET ?
    `).all(...values, pageSize, page * pageSize) as Row[];
    return { rows: rows.map((row) => this.transactionRow(row)), total, page, pageSize, pageCount };
  }

  private transactionRow(row: Row): LedgerTransaction {
    return {
      id: Number(row.id),
      transactionDate: String(row.transaction_date),
      kind: String(row.kind) as TransactionKind,
      amountUnits: Number(row.amount_units),
      categoryId: row.category_id === null ? null : Number(row.category_id),
      categoryName: String(row.category_name),
      categoryColor: String(row.category_color),
      description: String(row.description),
      notes: String(row.notes),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  dashboard(selection: PeriodSelection): DashboardData {
    const range = selectionToRange(selection);
    const totals = this.database.prepare(`
      SELECT COALESCE(SUM(CASE WHEN kind = 'INCOME' THEN amount_units ELSE 0 END), 0) AS income,
        COALESCE(SUM(CASE WHEN kind = 'EXPENSE' THEN amount_units ELSE 0 END), 0) AS expense
      FROM transactions WHERE transaction_date BETWEEN ? AND ?
    `).get(range.start, range.end) as Row;
    const before = this.database.prepare(`
      SELECT COALESCE(SUM(CASE WHEN kind = 'INCOME' THEN amount_units ELSE -amount_units END), 0) AS net
      FROM transactions WHERE transaction_date < ?
    `).get(range.start) as Row;
    const current = this.database.prepare(`
      SELECT COALESCE(SUM(CASE WHEN kind = 'INCOME' THEN amount_units ELSE -amount_units END), 0) AS net
      FROM transactions WHERE transaction_date <= ?
    `).get(localToday()) as Row;
    const settings = this.settings();
    const income = Number(totals.income);
    const expense = Number(totals.expense);
    const opening = settings.startingBalanceUnits + Number(before.net);
    const summary: Summary = {
      incomeUnits: income,
      expenseUnits: expense,
      netUnits: income - expense,
      openingBalanceUnits: opening,
      closingBalanceUnits: opening + income - expense,
      currentBalanceUnits: settings.startingBalanceUnits + Number(current.net),
    };
    const spendingRows = this.database.prepare(`
      SELECT COALESCE(c.name, 'Archived category') AS name, COALESCE(c.color, '#94A3B8') AS color,
        SUM(t.amount_units) AS total FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
      WHERE t.kind = 'EXPENSE' AND t.transaction_date BETWEEN ? AND ?
      GROUP BY t.category_id, name, color ORDER BY total DESC
    `).all(range.start, range.end) as Row[];
    const categorySpending: CategorySpending[] = spendingRows.map((row) => ({
      name: String(row.name), color: String(row.color), totalUnits: Number(row.total),
    }));
    const seriesRows = this.database.prepare(`
      SELECT transaction_date, SUM(CASE WHEN kind = 'INCOME' THEN amount_units ELSE -amount_units END) AS net
      FROM transactions WHERE transaction_date BETWEEN ? AND ? GROUP BY transaction_date ORDER BY transaction_date
    `).all(range.start, range.end) as Row[];
    const balanceSeries: BalancePoint[] = [{ date: range.start, balanceUnits: opening }];
    let running = opening;
    for (const row of seriesRows) {
      running += Number(row.net);
      balanceSeries.push({ date: String(row.transaction_date), balanceUnits: running });
    }
    if (balanceSeries.at(-1)?.date !== range.end) balanceSeries.push({ date: range.end, balanceUnits: running });
    return { range, summary, categorySpending, balanceSeries };
  }

  private amountForExport(amountUnits: number, currency: string): string {
    return (amountUnits / MONEY_SCALE).toFixed(displayFractionDigits(amountUnits, currency));
  }

  exportCsv(selection: PeriodSelection): string {
    const range = selectionToRange(selection);
    const rows = this.database.prepare(`
      SELECT t.*, COALESCE(c.name, 'Archived category') AS category_name
      FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
      WHERE t.transaction_date BETWEEN ? AND ? ORDER BY t.transaction_date, t.id
    `).all(range.start, range.end) as Row[];
    const currency = this.settings().currencyCode;
    const output: Array<Array<string | number>> = [["Date", "Type", `Amount (${currency})`, "Category", "Description", "Notes"]];
    for (const row of rows) {
      output.push([
        String(row.transaction_date),
        row.kind === "INCOME" ? "Money In" : "Money Out",
        this.amountForExport(Number(row.amount_units), currency),
        spreadsheetSafe(String(row.category_name)),
        spreadsheetSafe(String(row.description)),
        spreadsheetSafe(String(row.notes)),
      ]);
    }
    return `\uFEFF${output.map((line) => line.map(csvCell).join(",")).join("\r\n")}\r\n`;
  }

  createBackup(destination: string): void {
    if (resolve(destination) === resolve(this.path)) throw new Error("Choose a different file for the backup.");
    this.database.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    copyFileSync(this.path, destination);
  }

  restoreBackup(source: string): void {
    if (resolve(source) === resolve(this.path)) throw new Error("Choose a backup file, not the live database.");
    validateBackupPath(source);
    const staging = `${this.path}.restore-staging`;
    const rollback = `${this.path}.restore-rollback`;
    for (const path of [staging, rollback]) if (existsSync(path)) unlinkSync(path);
    copyFileSync(source, staging);
    validateBackupPath(staging);
    this.database.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    const safetyBackup = `${this.path}.before-restore-${timestampForFilename()}.tpbackup`;
    copyFileSync(this.path, safetyBackup);
    this.database.close();
    try {
      renameSync(this.path, rollback);
      renameSync(staging, this.path);
      this.database = this.open();
      this.initialize();
      validateLedgerDatabase(this.database);
      this.settings();
      this.categories(true);
      this.dashboard({ period: "all" });
      this.transactions({ selection: { period: "all" }, search: "", kind: null, page: 0, pageSize: 1 });
      if (existsSync(rollback)) unlinkSync(rollback);
    } catch (error) {
      try { this.database.close(); } catch { /* already closed */ }
      if (existsSync(this.path)) unlinkSync(this.path);
      if (existsSync(rollback)) renameSync(rollback, this.path);
      this.database = this.open();
      this.initialize();
      throw error;
    } finally {
      if (existsSync(staging)) unlinkSync(staging);
    }
  }
}

export function recoverDatabaseFromBackup(target: string, source: string): string | null {
  if (resolve(source) === resolve(target)) throw new Error("Choose a backup file, not the live database.");
  validateBackupPath(source);
  mkdirSync(dirname(target), { recursive: true });
  const staging = `${target}.recovery-staging`;
  if (existsSync(staging)) unlinkSync(staging);
  copyFileSync(source, staging);
  validateBackupPath(staging);

  const preserved = existsSync(target) ? `${target}.unreadable-${timestampForFilename()}` : null;
  const sidecars = [`${target}-wal`, `${target}-shm`];
  const preservedSidecars: Array<[string, string]> = [];
  try {
    if (preserved) {
      renameSync(target, preserved);
      for (const sidecar of sidecars) {
        if (existsSync(sidecar)) {
          const preservedSidecar = `${preserved}${sidecar.endsWith("-wal") ? "-wal" : "-shm"}`;
          renameSync(sidecar, preservedSidecar);
          preservedSidecars.push([sidecar, preservedSidecar]);
        }
      }
    }
    renameSync(staging, target);
    const verification = new LedgerDatabase(target);
    try {
      verification.bootstrap("recovery-check");
      verification.dashboard({ period: "all" });
      verification.transactions({ selection: { period: "all" }, search: "", kind: null, page: 0, pageSize: 1 });
    } finally {
      verification.close();
    }
    return preserved;
  } catch (error) {
    if (existsSync(target)) unlinkSync(target);
    if (preserved && existsSync(preserved)) renameSync(preserved, target);
    for (const [sidecar, preservedSidecar] of preservedSidecars) {
      if (existsSync(preservedSidecar)) renameSync(preservedSidecar, sidecar);
    }
    throw error;
  } finally {
    if (existsSync(staging)) unlinkSync(staging);
  }
}

export function defaultCustomPalette(): ThemePalette {
  return { ...THEMES.Cozy };
}
