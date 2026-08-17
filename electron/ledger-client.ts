import { Worker } from "node:worker_threads";
import { join } from "node:path";
import type {
  AppSettings,
  BootstrapData,
  Category,
  DashboardData,
  PeriodSelection,
  SaveCategoryInput,
  SaveTransactionInput,
  ThemeName,
  ThemePalette,
  TransactionFilters,
  TransactionPage,
} from "../shared/types";

interface WorkerError {
  message: string;
  stack?: string;
}

interface PendingRequest {
  resolve(value: unknown): void;
  reject(error: Error): void;
}

function revivedError(payload: WorkerError): Error {
  const error = new Error(payload.message);
  if (payload.stack) error.stack = payload.stack;
  return error;
}

export class LedgerClient {
  private readonly worker: Worker;
  private readonly pending = new Map<number, PendingRequest>();
  private readonly readyPromise: Promise<void>;
  private requestId = 0;
  private closed = false;

  constructor(path: string) {
    this.worker = new Worker(join(__dirname, "ledger-worker.js"), { workerData: { path } });
    this.readyPromise = new Promise((resolve, reject) => {
      const ready = (message: any) => {
        if (message?.type === "ready") {
          this.worker.off("message", ready);
          resolve();
        } else if (message?.type === "ready-error") {
          this.worker.off("message", ready);
          reject(revivedError(message.error));
        }
      };
      this.worker.on("message", ready);
    });
    this.worker.on("message", (message: any) => {
      if (message?.type !== "result") return;
      const request = this.pending.get(message.id);
      if (!request) return;
      this.pending.delete(message.id);
      if (message.error) request.reject(revivedError(message.error));
      else request.resolve(message.result);
    });
    this.worker.on("error", (error) => this.failAll(error));
    this.worker.on("exit", (code) => {
      if (!this.closed && code !== 0) this.failAll(new Error(`Tallypine's database worker stopped unexpectedly (${code}).`));
    });
  }

  ready(): Promise<void> { return this.readyPromise; }

  private failAll(error: Error): void {
    for (const request of this.pending.values()) request.reject(error);
    this.pending.clear();
  }

  private async call<T>(method: string, ...args: unknown[]): Promise<T> {
    await this.readyPromise;
    if (this.closed) throw new Error("Tallypine's local database is closed.");
    const id = ++this.requestId;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
      this.worker.postMessage({ id, method, args });
    });
  }

  bootstrap(version: string, storageDirectory: string): Promise<BootstrapData> { return this.call("bootstrap", version, storageDirectory); }
  settings(): Promise<AppSettings> { return this.call("settings"); }
  dashboard(selection: PeriodSelection): Promise<DashboardData> { return this.call("dashboard", selection); }
  transactions(filters: TransactionFilters): Promise<TransactionPage> { return this.call("transactions", filters); }
  categories(includeArchived = false): Promise<Category[]> { return this.call("categories", includeArchived); }
  saveTransaction(input: SaveTransactionInput): Promise<number> { return this.call("saveTransaction", input); }
  deleteTransaction(id: number): Promise<void> { return this.call("deleteTransaction", id); }
  saveCategory(input: SaveCategoryInput): Promise<number> { return this.call("saveCategory", input); }
  archiveCategory(id: number): Promise<void> { return this.call("archiveCategory", id); }
  setStartingBalance(value: string): Promise<AppSettings> { return this.call("setStartingBalance", value); }
  setCurrency(code: string): Promise<AppSettings> { return this.call("setCurrency", code); }
  setTheme(name: ThemeName): Promise<AppSettings> { return this.call("setTheme", name); }
  saveCustomTheme(palette: ThemePalette): Promise<AppSettings> { return this.call("saveCustomTheme", palette); }
  completeOnboarding(currency: string, balance: string): Promise<AppSettings> { return this.call("completeOnboarding", currency, balance); }
  exportCsv(selection: PeriodSelection): Promise<string> { return this.call("exportCsv", selection); }
  createBackup(destination: string): Promise<void> { return this.call("createBackup", destination); }
  restoreBackup(source: string): Promise<void> { return this.call("restoreBackup", source); }

  async close(): Promise<void> {
    if (this.closed) return;
    try { await this.call<void>("close"); } finally {
      this.closed = true;
      await this.worker.terminate();
    }
  }
}
