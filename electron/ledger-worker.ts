import { parentPort, workerData } from "node:worker_threads";
import { LedgerDatabase } from "./database";

interface WorkerRequest {
  id: number;
  method: string;
  args: unknown[];
}

function errorPayload(error: unknown): { message: string; stack?: string } {
  return error instanceof Error ? { message: error.message, stack: error.stack } : { message: String(error) };
}

if (!parentPort || typeof workerData?.path !== "string") throw new Error("Tallypine's database worker could not start.");

let database: LedgerDatabase;
try {
  database = new LedgerDatabase(workerData.path);
  parentPort.postMessage({ type: "ready" });
} catch (error) {
  parentPort.postMessage({ type: "ready-error", error: errorPayload(error) });
  throw error;
}

parentPort.on("message", (request: WorkerRequest) => {
  try {
    let result: unknown;
    switch (request.method) {
      case "bootstrap": result = database.bootstrap(request.args[0] as string, request.args[1] as string); break;
      case "settings": result = database.settings(); break;
      case "dashboard": result = database.dashboard(request.args[0] as never); break;
      case "transactions": result = database.transactions(request.args[0] as never); break;
      case "categories": result = database.categories(Boolean(request.args[0])); break;
      case "saveTransaction": result = database.saveTransaction(request.args[0] as never); break;
      case "deleteTransaction": result = database.deleteTransaction(request.args[0] as number); break;
      case "saveCategory": result = database.saveCategory(request.args[0] as never); break;
      case "archiveCategory": result = database.archiveCategory(request.args[0] as number); break;
      case "setStartingBalance": result = database.setStartingBalance(request.args[0] as string); break;
      case "setCurrency": result = database.setCurrency(request.args[0] as string); break;
      case "setTheme": result = database.setTheme(request.args[0] as never); break;
      case "saveCustomTheme": result = database.saveCustomTheme(request.args[0] as never); break;
      case "completeOnboarding": result = database.completeOnboarding(request.args[0] as string, request.args[1] as string); break;
      case "exportCsv": result = database.exportCsv(request.args[0] as never); break;
      case "createBackup": result = database.createBackup(request.args[0] as string); break;
      case "restoreBackup": result = database.restoreBackup(request.args[0] as string); break;
      case "close": database.close(); result = undefined; break;
      default: throw new Error("Tallypine blocked an unknown database operation.");
    }
    parentPort!.postMessage({ type: "result", id: request.id, result });
  } catch (error) {
    parentPort!.postMessage({ type: "result", id: request.id, error: errorPayload(error) });
  }
});
