import type {
  AppSettings,
  BalancePoint,
  Category,
  DashboardData,
  LedgerTransaction,
  PeriodSelection,
  TallypineApi,
  ThemePalette,
} from "../../shared/types";
import { MONEY_SCALE } from "../../shared/money";

const categories: Category[] = [
  { id: 1, name: "Groceries", kind: "EXPENSE", color: "#F97316", active: true },
  { id: 2, name: "Dining out", kind: "EXPENSE", color: "#EF4444", active: true },
  { id: 3, name: "Transport", kind: "EXPENSE", color: "#38BDF8", active: true },
  { id: 4, name: "Housing", kind: "EXPENSE", color: "#8B5CF6", active: true },
  { id: 5, name: "Subscriptions", kind: "EXPENSE", color: "#EC4899", active: true },
  { id: 6, name: "Salary", kind: "INCOME", color: "#22C55E", active: true },
  { id: 7, name: "Gift", kind: "INCOME", color: "#2DD4BF", active: true },
];

let settings: AppSettings = {
  startingBalanceUnits: 0,
  currencyCode: "NOK",
  themeName: "Sunshine",
  customTheme: null,
  onboardingComplete: !new URLSearchParams(window.location.search).has("firstRun"),
};

let rows: LedgerTransaction[] = [
  { id: 4, transactionDate: "2026-08-13", kind: "EXPENSE", amountUnits: 899000, categoryId: 1, categoryName: "Groceries", categoryColor: "#F97316", description: "Weekly groceries", notes: "", createdAt: "", updatedAt: "" },
  { id: 3, transactionDate: "2026-08-10", kind: "EXPENSE", amountUnits: 1290000, categoryId: 5, categoryName: "Subscriptions", categoryColor: "#EC4899", description: "Creative software", notes: "", createdAt: "", updatedAt: "" },
  { id: 2, transactionDate: "2026-08-07", kind: "EXPENSE", amountUnits: 430000, categoryId: 3, categoryName: "Transport", categoryColor: "#38BDF8", description: "Train ticket", notes: "", createdAt: "", updatedAt: "" },
  { id: 1, transactionDate: "2026-08-01", kind: "INCOME", amountUnits: 32500000, categoryId: 6, categoryName: "Salary", categoryColor: "#22C55E", description: "Monthly salary", notes: "", createdAt: "", updatedAt: "" },
];

function range(selection: PeriodSelection) {
  const previewToday = "2026-08-14";
  if (selection.period === "all") return { start: "2026-01-01", end: "2026-08-14", label: "All time" };
  if (selection.period === "year") return { start: `${selection.year}-01-01`, end: selection.year === 2026 ? previewToday : `${selection.year}-12-31`, label: String(selection.year) };
  if (selection.period === "week") {
    const fourth = new Date(selection.year ?? 2026, 0, 4);
    const monday = new Date(fourth);
    monday.setDate(fourth.getDate() - ((fourth.getDay() || 7) - 1) + ((selection.week ?? 1) - 1) * 7);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const start = iso(monday) < "2026-01-01" ? "2026-01-01" : iso(monday);
    const fullEnd = iso(sunday);
    return { start, end: fullEnd > previewToday ? previewToday : fullEnd, label: `Week ${selection.week}, ${selection.year}` };
  }
  const month = new Date(2000, (selection.month ?? 1) - 1, 1).toLocaleDateString("en-US", { month: "long" });
  const monthNumber = selection.month ?? 1;
  const lastDay = new Date(selection.year ?? 2026, monthNumber, 0).getDate();
  const end = selection.year === 2026 && monthNumber === 8 ? previewToday : `${selection.year}-${String(monthNumber).padStart(2, "0")}-${lastDay}`;
  return { start: `${selection.year}-${String(monthNumber).padStart(2, "0")}-01`, end, label: `${month} ${selection.year}` };
}

function dashboard(selection: PeriodSelection): DashboardData {
  const selectedRange = range(selection);
  const selectedRows = rows.filter((row) => row.transactionDate >= selectedRange.start && row.transactionDate <= selectedRange.end);
  const before = rows.filter((row) => row.transactionDate < selectedRange.start).reduce((sum, row) => sum + (row.kind === "INCOME" ? row.amountUnits : -row.amountUnits), 0);
  const income = selectedRows.filter((row) => row.kind === "INCOME").reduce((sum, row) => sum + row.amountUnits, 0);
  const expense = selectedRows.filter((row) => row.kind === "EXPENSE").reduce((sum, row) => sum + row.amountUnits, 0);
  const spending = new Map<string, { name: string; color: string; totalUnits: number }>();
  for (const row of selectedRows.filter((row) => row.kind === "EXPENSE")) {
    const current = spending.get(row.categoryName) ?? { name: row.categoryName, color: row.categoryColor, totalUnits: 0 };
    current.totalUnits += row.amountUnits;
    spending.set(row.categoryName, current);
  }
  const opening = settings.startingBalanceUnits + before;
  const balanceSeries: BalancePoint[] = [{ date: selectedRange.start, balanceUnits: opening }];
  let running = opening;
  for (const row of [...selectedRows].sort((a, b) => a.transactionDate.localeCompare(b.transactionDate) || a.id - b.id)) {
    running += row.kind === "INCOME" ? row.amountUnits : -row.amountUnits;
    const previous = balanceSeries.at(-1);
    if (previous?.date === row.transactionDate && previous.date !== selectedRange.start) previous.balanceUnits = running;
    else balanceSeries.push({ date: row.transactionDate, balanceUnits: running });
  }
  if (balanceSeries.at(-1)?.date !== selectedRange.end) balanceSeries.push({ date: selectedRange.end, balanceUnits: running });
  const currentBalance = settings.startingBalanceUnits + rows.reduce((sum, row) => sum + (row.kind === "INCOME" ? row.amountUnits : -row.amountUnits), 0);
  return {
    range: selectedRange,
    summary: { incomeUnits: income, expenseUnits: expense, netUnits: income - expense, openingBalanceUnits: opening, closingBalanceUnits: running, currentBalanceUnits: currentBalance },
    categorySpending: [...spending.values()].sort((a, b) => b.totalUnits - a.totalUnits),
    balanceSeries,
  };
}

export function installMockApi(): void {
  if (window.tallypine) return;
  const api: TallypineApi = {
    bootstrap: async () => ({ settings, categories: categories.filter((category) => category.active), today: "2026-08-14", minYear: 2026, version: "1.0.0", storageDirectory: "Browser preview memory" }),
    dashboard: async (selection) => dashboard(selection),
    transactions: async (filters) => {
      const query = filters.search.toLowerCase();
      const selectedRange = range(filters.selection);
      const filtered = rows.filter((row) => row.transactionDate >= selectedRange.start && row.transactionDate <= selectedRange.end && (!filters.kind || row.kind === filters.kind) && (!query || `${row.description} ${row.categoryName} ${row.notes}`.toLowerCase().includes(query)));
      return { rows: filtered.slice(filters.page * filters.pageSize, (filters.page + 1) * filters.pageSize), total: filtered.length, page: filters.page, pageSize: filters.pageSize, pageCount: Math.max(1, Math.ceil(filtered.length / filters.pageSize)) };
    },
    categories: async (includeArchived) => categories.filter((category) => includeArchived || category.active),
    saveTransaction: async (input) => {
      const category = categories.find((value) => value.id === input.categoryId)!;
      const amountUnits = Math.round(Number(input.amount.replace(",", ".")) * MONEY_SCALE);
      if (input.id) rows = rows.map((row) => row.id === input.id ? { ...row, transactionDate: input.transactionDate, kind: input.kind, amountUnits, categoryId: category.id, categoryName: category.name, categoryColor: category.color, description: input.description, notes: input.notes } : row);
      else rows = [{ id: Math.max(0, ...rows.map((row) => row.id)) + 1, transactionDate: input.transactionDate, kind: input.kind, amountUnits, categoryId: category.id, categoryName: category.name, categoryColor: category.color, description: input.description, notes: input.notes, createdAt: "", updatedAt: "" }, ...rows];
      return input.id ?? rows[0].id;
    },
    deleteTransaction: async (id) => { rows = rows.filter((row) => row.id !== id); },
    saveCategory: async (input) => {
      if (input.id) {
        const category = categories.find((value) => value.id === input.id)!;
        Object.assign(category, input);
        return input.id;
      }
      const id = Math.max(...categories.map((category) => category.id)) + 1;
      categories.push({ id, name: input.name, kind: input.kind, color: input.color, active: true });
      return id;
    },
    archiveCategory: async (id) => { const category = categories.find((value) => value.id === id); if (category) category.active = false; },
    setStartingBalance: async (amount) => { settings = { ...settings, startingBalanceUnits: Math.round(Number(amount.replace(",", ".")) * MONEY_SCALE) }; return settings; },
    setCurrency: async (code) => { settings = { ...settings, currencyCode: code }; return settings; },
    setTheme: async (themeName) => { settings = { ...settings, themeName }; return settings; },
    saveCustomTheme: async (customTheme: ThemePalette) => { settings = { ...settings, customTheme, themeName: "Custom" }; return settings; },
    completeOnboarding: async (currency, balance) => { settings = { ...settings, currencyCode: currency, startingBalanceUnits: Math.round(Number(balance.replace(",", ".")) * MONEY_SCALE), onboardingComplete: true }; return settings; },
    exportCsv: async () => ({ canceled: false, message: "Preview export completed." }),
    createBackup: async () => ({ canceled: false, message: "Preview backup completed." }),
    restoreBackup: async () => ({ canceled: true }),
    rendererReady: async () => undefined,
    windowMinimize: async () => undefined,
    windowToggleMaximize: async () => false,
    windowSetBackground: async () => undefined,
    windowClose: async () => undefined,
  };
  window.tallypine = api;
}
