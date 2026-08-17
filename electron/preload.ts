import { contextBridge, ipcRenderer } from "electron";
import type { TallypineApi } from "../shared/types";

const api: TallypineApi = {
  bootstrap: () => ipcRenderer.invoke("app:bootstrap"),
  dashboard: (selection) => ipcRenderer.invoke("app:dashboard", selection),
  transactions: (filters) => ipcRenderer.invoke("app:transactions", filters),
  categories: (includeArchived) => ipcRenderer.invoke("app:categories", includeArchived),
  saveTransaction: (input) => ipcRenderer.invoke("app:save-transaction", input),
  deleteTransaction: (id) => ipcRenderer.invoke("app:delete-transaction", id),
  saveCategory: (input) => ipcRenderer.invoke("app:save-category", input),
  archiveCategory: (id) => ipcRenderer.invoke("app:archive-category", id),
  setStartingBalance: (value) => ipcRenderer.invoke("app:set-starting-balance", value),
  setCurrency: (code) => ipcRenderer.invoke("app:set-currency", code),
  setTheme: (name) => ipcRenderer.invoke("app:set-theme", name),
  saveCustomTheme: (palette) => ipcRenderer.invoke("app:save-custom-theme", palette),
  completeOnboarding: (currency, startingBalance) => ipcRenderer.invoke("app:complete-onboarding", currency, startingBalance),
  exportCsv: (selection) => ipcRenderer.invoke("app:export-csv", selection),
  createBackup: () => ipcRenderer.invoke("app:create-backup"),
  restoreBackup: () => ipcRenderer.invoke("app:restore-backup"),
  rendererReady: () => ipcRenderer.invoke("app:renderer-ready"),
  windowMinimize: () => ipcRenderer.invoke("window:minimize"),
  windowToggleMaximize: () => ipcRenderer.invoke("window:toggle-maximize"),
  windowSetBackground: (color) => ipcRenderer.invoke("window:set-background", color),
  windowClose: () => ipcRenderer.invoke("window:close"),
};

contextBridge.exposeInMainWorld("tallypine", api);
