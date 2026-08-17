import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LedgerDatabase, parseAmount, recoverDatabaseFromBackup, selectionToRange } from "../electron/database";
import { THEMES } from "../shared/themes";

describe("Tallypine ledger", () => {
  let directory: string;
  let path: string;
  let database: LedgerDatabase;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "tallypine-electron-test-"));
    path = join(directory, "tallypine.db");
    database = new LedgerDatabase(path);
  });

  afterEach(() => {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it("starts at zero in Sunshine and never requires a login", () => {
    const data = database.bootstrap("1.0.0");
    expect(data.settings.startingBalanceUnits).toBe(0);
    expect(data.settings.themeName).toBe("Sunshine");
    expect(data.settings.currencyCode).toBe("NOK");
    expect(data.settings.onboardingComplete).toBe(false);
    expect(data.categories.length).toBe(14);
  });

  it("parses decimal comma, decimal point, rounding, and signed balances", () => {
    expect(parseAmount("1 234,56")).toBe(12345600);
    expect(parseAmount("1,234.56")).toBe(12345600);
    expect(parseAmount("1.005", false, 3)).toBe(10050);
    expect(() => parseAmount("1.005")).toThrow(/2 decimal places/i);
    expect(parseAmount("-17.90", true)).toBe(-179000);
    expect(() => parseAmount("0")).toThrow(/greater than zero/i);
  });

  it("keeps reporting years at 2026 or later", () => {
    expect(selectionToRange({ period: "all" }, "2026-08-14").start).toBe("2026-01-01");
    expect(() => selectionToRange({ period: "year", year: 2025 }, "2026-08-14")).toThrow(/available year/i);
    expect(selectionToRange({ period: "month", year: 2026, month: 8 }, "2026-08-14")).toEqual({
      start: "2026-08-01",
      end: "2026-08-14",
      label: "August 2026",
    });
    expect(selectionToRange({ period: "week", year: 2026, week: 1 }, "2026-08-14").start).toBe("2026-01-01");
  });

  it("adds, reports, edits, filters, and deletes transactions", () => {
    const categories = database.categories();
    const salary = categories.find((category) => category.name === "Salary")!;
    const groceries = categories.find((category) => category.name === "Groceries")!;
    const incomeId = database.saveTransaction({
      transactionDate: "2026-02-02",
      kind: "INCOME",
      amount: "2000.00",
      categoryId: salary.id,
      description: "Payday",
      notes: "February",
    });
    const expenseId = database.saveTransaction({
      transactionDate: "2026-02-03",
      kind: "EXPENSE",
      amount: "320,50",
      categoryId: groceries.id,
      description: "Weekly food",
      notes: "",
    });
    const report = database.dashboard({ period: "month", year: 2026, month: 2 });
    expect(report.summary.incomeUnits).toBe(20000000);
    expect(report.summary.expenseUnits).toBe(3205000);
    expect(report.summary.closingBalanceUnits).toBe(16795000);
    expect(report.categorySpending[0]).toMatchObject({ name: "Groceries", totalUnits: 3205000 });
    const page = database.transactions({ selection: { period: "year", year: 2026 }, search: "food", kind: "EXPENSE", page: 0, pageSize: 20 });
    expect(page.total).toBe(1);
    expect(page.rows[0].id).toBe(expenseId);
    database.saveTransaction({
      id: incomeId,
      transactionDate: "2026-02-02",
      kind: "INCOME",
      amount: "2100.00",
      categoryId: salary.id,
      description: "Payday edited",
      notes: "",
    });
    database.deleteTransaction(expenseId);
    expect(database.transactions({ selection: { period: "year", year: 2026 }, search: "", kind: null, page: 0, pageSize: 20 }).total).toBe(1);
  });

  it("keeps settings and custom theme data compatible with the old schema", () => {
    expect(database.setCurrency("USD").currencyCode).toBe("USD");
    expect(database.setStartingBalance("179.00").startingBalanceUnits).toBe(1790000);
    const custom = { ...THEMES.Cozy, accent: "#ABCDEF" };
    const settings = database.saveCustomTheme(custom);
    expect(settings.themeName).toBe("Custom");
    expect(settings.customTheme).toEqual(custom);
    database.close();
    database = new LedgerDatabase(path);
    expect(database.settings().customTheme).toEqual(custom);
    expect(existsSync(`${path}.pre-migration-1.0.tpbackup`)).toBe(true);
  });

  it("creates and restores a verified complete backup", () => {
    const salary = database.categories().find((category) => category.name === "Salary")!;
    database.saveTransaction({ transactionDate: "2026-03-01", kind: "INCOME", amount: "50", categoryId: salary.id, description: "Before backup", notes: "" });
    const backup = join(directory, "ledger.tpbackup");
    database.createBackup(backup);
    database.saveTransaction({ transactionDate: "2026-03-02", kind: "INCOME", amount: "25", categoryId: salary.id, description: "After backup", notes: "" });
    expect(database.transactions({ selection: { period: "year", year: 2026 }, search: "", kind: null, page: 0, pageSize: 20 }).total).toBe(2);
    database.restoreBackup(backup);
    expect(database.transactions({ selection: { period: "year", year: 2026 }, search: "", kind: null, page: 0, pageSize: 20 }).total).toBe(1);
    expect(readdirSync(directory).some((name) => name.includes("before-restore-") && name.endsWith(".tpbackup"))).toBe(true);
  });

  it("rejects a healthy SQLite file with an incompatible Tallypine schema without replacing current data", () => {
    const salary = database.categories().find((category) => category.name === "Salary")!;
    database.saveTransaction({ transactionDate: "2026-03-01", kind: "INCOME", amount: "50", categoryId: salary.id, description: "Keep me", notes: "" });
    const incompatible = join(directory, "incompatible.tpbackup");
    const wrong = new DatabaseSync(incompatible);
    wrong.exec(`
      CREATE TABLE settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE categories(id INTEGER PRIMARY KEY, name TEXT, kind TEXT, color TEXT, active INTEGER);
      CREATE TABLE transactions(id INTEGER PRIMARY KEY, transaction_date TEXT, kind TEXT, category_id INTEGER, description TEXT, notes TEXT, created_at TEXT, updated_at TEXT);
    `);
    wrong.close();
    expect(() => database.restoreBackup(incompatible)).toThrow(/missing transaction amounts/i);
    expect(database.transactions({ selection: { period: "all" }, search: "Keep me", kind: null, page: 0, pageSize: 20 }).total).toBe(1);
  });

  it("preserves an archived category on edits but blocks it for new transactions", () => {
    const groceries = database.categories().find((category) => category.name === "Groceries")!;
    const id = database.saveTransaction({ transactionDate: "2026-03-01", kind: "EXPENSE", amount: "10", categoryId: groceries.id, description: "Original", notes: "" });
    database.archiveCategory(groceries.id);
    database.saveTransaction({ id, transactionDate: "2026-03-01", kind: "EXPENSE", amount: "10", categoryId: groceries.id, description: "Edited", notes: "" });
    expect(database.transactions({ selection: { period: "all" }, search: "Edited", kind: null, page: 0, pageSize: 20 }).rows[0].categoryName).toBe("Groceries");
    expect(() => database.saveTransaction({ transactionDate: "2026-03-02", kind: "EXPENSE", amount: "5", categoryId: groceries.id, description: "Blocked", notes: "" })).toThrow(/active category/i);
  });

  it("keeps Balance Now independent of a historical reporting period and preserves the opening chart point", () => {
    const salary = database.categories().find((category) => category.name === "Salary")!;
    const groceries = database.categories().find((category) => category.name === "Groceries")!;
    database.saveTransaction({ transactionDate: "2026-01-01", kind: "INCOME", amount: "100", categoryId: salary.id, description: "January", notes: "" });
    database.saveTransaction({ transactionDate: "2026-08-01", kind: "EXPENSE", amount: "20", categoryId: groceries.id, description: "August", notes: "" });
    const january = database.dashboard({ period: "month", year: 2026, month: 1 });
    expect(january.summary.closingBalanceUnits).toBe(1000000);
    expect(january.summary.currentBalanceUnits).toBe(800000);
    expect(january.balanceSeries.slice(0, 2)).toEqual([
      { date: "2026-01-01", balanceUnits: 0 },
      { date: "2026-01-01", balanceUnits: 1000000 },
    ]);
  });

  it("uses the selected currency's supported precision", () => {
    const salary = database.categories().find((category) => category.name === "Salary")!;
    database.setCurrency("JPY");
    expect(() => database.saveTransaction({ transactionDate: "2026-03-01", kind: "INCOME", amount: "1.5", categoryId: salary.id, description: "Invalid yen", notes: "" })).toThrow(/0 decimal places/i);
    database.setCurrency("KWD");
    database.saveTransaction({ transactionDate: "2026-03-01", kind: "INCOME", amount: "1.234", categoryId: salary.id, description: "Kuwaiti amount", notes: "" });
    expect(database.transactions({ selection: { period: "all" }, search: "Kuwaiti", kind: null, page: 0, pageSize: 20 }).rows[0].amountUnits).toBe(12340);
  });

  it("migrates the existing two-decimal database schema without changing values", () => {
    const legacyPath = join(directory, "legacy.db");
    const legacy = new DatabaseSync(legacyPath);
    legacy.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL COLLATE NOCASE, kind TEXT NOT NULL, color TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, UNIQUE(name, kind));
      CREATE TABLE transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, transaction_date TEXT NOT NULL, kind TEXT NOT NULL, amount_ore INTEGER NOT NULL, category_id INTEGER, description TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY(category_id) REFERENCES categories(id));
      INSERT INTO settings(key, value) VALUES('starting_balance_ore', '17900'), ('currency_code', 'NOK'), ('theme_name', 'Sunshine'), ('onboarding_complete', '1');
      INSERT INTO categories(id, name, kind, color, active) VALUES(1, 'Salary', 'INCOME', '#22C55E', 1);
      INSERT INTO transactions(transaction_date, kind, amount_ore, category_id, description, notes, created_at, updated_at) VALUES('2026-03-01', 'INCOME', 12345, 1, 'Legacy amount', '', '2026-03-01T00:00:00Z', '2026-03-01T00:00:00Z');
    `);
    legacy.close();
    const migrated = new LedgerDatabase(legacyPath);
    try {
      expect(migrated.settings().startingBalanceUnits).toBe(1790000);
      expect(migrated.transactions({ selection: { period: "all" }, search: "Legacy", kind: null, page: 0, pageSize: 20 }).rows[0].amountUnits).toBe(1234500);
      expect(existsSync(`${legacyPath}.pre-schema-2.tpbackup`)).toBe(true);
    } finally {
      migrated.close();
    }
  });

  it("recovers an unreadable startup database while preserving the original file", () => {
    const backup = join(directory, "startup.tpbackup");
    database.createBackup(backup);
    const unreadablePath = join(directory, "unreadable.db");
    const unreadable = new DatabaseSync(unreadablePath);
    unreadable.exec("CREATE TABLE unrelated(value TEXT)");
    unreadable.close();
    const preserved = recoverDatabaseFromBackup(unreadablePath, backup);
    expect(preserved).not.toBeNull();
    expect(existsSync(preserved!)).toBe(true);
    const recovered = new LedgerDatabase(unreadablePath);
    try {
      expect(recovered.bootstrap("1.0.0").categories.length).toBeGreaterThan(0);
    } finally {
      recovered.close();
    }
  });
});
