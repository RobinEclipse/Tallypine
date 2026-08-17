export type TransactionKind = "INCOME" | "EXPENSE";
export type ThemeName = "Eclipse" | "Cozy" | "Sunshine" | "Custom";
export type ThemeMode = "dark" | "light";
export type PeriodKind = "week" | "month" | "year" | "all";

export interface ThemePalette {
  mode: ThemeMode;
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  accentHover: string;
  green: string;
  red: string;
  amber: string;
}

export interface AppSettings {
  startingBalanceUnits: number;
  currencyCode: string;
  themeName: ThemeName;
  customTheme: ThemePalette | null;
  onboardingComplete: boolean;
}

export interface PeriodSelection {
  period: PeriodKind;
  year?: number;
  month?: number;
  week?: number;
}

export interface DateRange {
  start: string;
  end: string;
  label: string;
}

export interface Summary {
  incomeUnits: number;
  expenseUnits: number;
  netUnits: number;
  openingBalanceUnits: number;
  closingBalanceUnits: number;
  currentBalanceUnits: number;
}

export interface Category {
  id: number;
  name: string;
  kind: TransactionKind;
  color: string;
  active: boolean;
}

export interface CategorySpending {
  name: string;
  color: string;
  totalUnits: number;
}

export interface BalancePoint {
  date: string;
  balanceUnits: number;
}

export interface DashboardData {
  range: DateRange;
  summary: Summary;
  categorySpending: CategorySpending[];
  balanceSeries: BalancePoint[];
}

export interface LedgerTransaction {
  id: number;
  transactionDate: string;
  kind: TransactionKind;
  amountUnits: number;
  categoryId: number | null;
  categoryName: string;
  categoryColor: string;
  description: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionFilters {
  selection: PeriodSelection;
  search: string;
  kind: TransactionKind | null;
  page: number;
  pageSize: number;
}

export interface TransactionPage {
  rows: LedgerTransaction[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface SaveTransactionInput {
  id?: number;
  transactionDate: string;
  kind: TransactionKind;
  amount: string;
  categoryId: number;
  description: string;
  notes: string;
}

export interface SaveCategoryInput {
  id?: number;
  name: string;
  kind: TransactionKind;
  color: string;
}

export interface BootstrapData {
  settings: AppSettings;
  categories: Category[];
  today: string;
  minYear: number;
  version: string;
  storageDirectory: string;
}

export interface ResultMessage {
  canceled: boolean;
  message?: string;
}

export interface TallypineApi {
  bootstrap(): Promise<BootstrapData>;
  dashboard(selection: PeriodSelection): Promise<DashboardData>;
  transactions(filters: TransactionFilters): Promise<TransactionPage>;
  categories(includeArchived?: boolean): Promise<Category[]>;
  saveTransaction(input: SaveTransactionInput): Promise<number>;
  deleteTransaction(id: number): Promise<void>;
  saveCategory(input: SaveCategoryInput): Promise<number>;
  archiveCategory(id: number): Promise<void>;
  setStartingBalance(amount: string): Promise<AppSettings>;
  setCurrency(code: string): Promise<AppSettings>;
  setTheme(name: ThemeName): Promise<AppSettings>;
  saveCustomTheme(palette: ThemePalette): Promise<AppSettings>;
  completeOnboarding(currency: string, startingBalance: string): Promise<AppSettings>;
  exportCsv(selection: PeriodSelection): Promise<ResultMessage>;
  createBackup(): Promise<ResultMessage>;
  restoreBackup(): Promise<ResultMessage>;
  rendererReady(): Promise<void>;
  windowMinimize(): Promise<void>;
  windowToggleMaximize(): Promise<boolean>;
  windowSetBackground(color: string): Promise<void>;
  windowClose(): Promise<void>;
}
