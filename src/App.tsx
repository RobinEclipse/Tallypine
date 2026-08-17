import { AlertTriangle } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AppSettings,
  BootstrapData,
  Category,
  DashboardData,
  LedgerTransaction,
  PeriodSelection,
  TransactionKind,
  TransactionPage,
} from "../shared/types";
import { CurrencyScreen } from "./components/CurrencyScreen";
import { Dashboard } from "./components/Dashboard";
import { ConfirmModal, TransactionModal } from "./components/Modals";
import { Onboarding } from "./components/Onboarding";
import { SettingsScreen } from "./components/SettingsScreen";
import { applyPalette, ThemePanel } from "./components/ThemePanel";
import { TitleBar } from "./components/TitleBar";
import logo from "./assets/tallypine-logo.png";
import { defaultSelection, readableError } from "./lib/format";

type ViewName = "dashboard" | "settings" | "currency";
type TransitionPhase = "idle" | "cover" | "hold" | "reveal";

interface Toast {
  id: number;
  message: string;
  kind: "success" | "error";
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export default function App() {
  const [bootstrap, setBootstrap] = useState<BootstrapData | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [view, setView] = useState<ViewName>("dashboard");
  const [phase, setPhase] = useState<TransitionPhase>("idle");
  const [selection, setSelection] = useState<PeriodSelection>({ period: "all" });
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [transactions, setTransactions] = useState<TransactionPage | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [kind, setKind] = useState<TransactionKind | null>(null);
  const [page, setPage] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [themeOpen, setThemeOpen] = useState(false);
  const [transactionModal, setTransactionModal] = useState<{ open: boolean; transaction: LedgerTransaction | null }>({ open: false, transaction: null });
  const [deleteTarget, setDeleteTarget] = useState<LedgerTransaction | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const navigating = useRef(false);
  const currencyReturn = useRef<ViewName>("dashboard");
  const toastId = useRef(0);

  const notify = useCallback((message: string, kindValue: "success" | "error" = "success") => {
    const id = ++toastId.current;
    setToasts((current) => [...current.slice(-2), { id, message, kind: kindValue }]);
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4_200);
  }, []);

  const reload = useCallback(async () => {
    try {
      const latest = await window.tallypine.bootstrap();
      setBootstrap(latest);
      setFatalError(null);
      setSettings(latest.settings);
      setCategories(latest.categories);
      setRefreshKey((value) => value + 1);
    } catch (error) {
      const message = readableError(error);
      setFatalError(message);
      notify(message, "error");
    }
  }, [notify]);

  useEffect(() => {
    let active = true;
    void window.tallypine.bootstrap().then(async (data) => {
      if (!active) return;
      applyPalette(data.settings.themeName, data.settings.customTheme);
      setBootstrap(data);
      setSettings(data.settings);
      setCategories(data.categories);
      setSelection(defaultSelection(data.today));
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      await window.tallypine.rendererReady();
    }).catch(async (error) => {
      const message = readableError(error);
      setFatalError(message);
      notify(message, "error");
      await window.tallypine.rendererReady();
    });
    return () => { active = false; };
  }, [notify]);

  useEffect(() => {
    if (!bootstrap) return;
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
    const timer = window.setTimeout(() => void reload(), Math.max(1_000, nextMidnight.getTime() - now.getTime()));
    return () => window.clearTimeout(timer);
  }, [bootstrap?.today, reload]);

  useEffect(() => {
    if (!settings) return;
    applyPalette(settings.themeName, settings.customTheme);
  }, [settings]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 140);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!bootstrap) return;
    let active = true;
    void window.tallypine.dashboard(selection).then((data) => {
      if (active) setDashboard(data);
    }).catch((error) => notify(readableError(error), "error"));
    return () => { active = false; };
  }, [bootstrap, selection, refreshKey, notify]);

  useEffect(() => {
    if (!bootstrap) return;
    let active = true;
    void window.tallypine.transactions({ selection, search: debouncedSearch, kind, page, pageSize: 20 }).then((data) => {
      if (active) {
        setTransactions(data);
        if (data.page !== page) setPage(data.page);
      }
    }).catch((error) => notify(readableError(error), "error"));
    return () => { active = false; };
  }, [bootstrap, selection, debouncedSearch, kind, page, refreshKey, notify]);

  async function navigate(destination: ViewName) {
    if (destination === view || navigating.current) return;
    navigating.current = true;
    setPhase("cover");
    await wait(180);
    setPhase("hold");
    await wait(200);
    setView(destination);
    setPhase("reveal");
    await wait(500);
    setPhase("idle");
    navigating.current = false;
  }

  function changeSelection(value: PeriodSelection) {
    setSelection(value);
    setPage(0);
  }

  async function selectCurrency(code: string) {
    try {
      const updated = await window.tallypine.setCurrency(code);
      setSettings(updated);
      notify(`Currency changed to ${code}.`);
      setRefreshKey((value) => value + 1);
      await navigate(currencyReturn.current);
    } catch (error) { notify(readableError(error), "error"); }
  }

  async function removeTransaction() {
    if (!deleteTarget) return;
    try {
      await window.tallypine.deleteTransaction(deleteTarget.id);
      setDeleteTarget(null);
      setRefreshKey((value) => value + 1);
      notify("Transaction deleted.");
    } catch (error) { notify(readableError(error), "error"); }
  }

  async function exportCsv() {
    try {
      const result = await window.tallypine.exportCsv(selection);
      if (!result.canceled) notify(result.message ?? "CSV export saved.");
    } catch (error) { notify(readableError(error), "error"); }
  }

  const screens = useMemo(() => ({ dashboard: view === "dashboard", settings: view === "settings", currency: view === "currency" }), [view]);

  if (fatalError) {
    return <div className="app-frame"><TitleBar /><main className="fatal-screen"><AlertTriangle size={34} /><h1>Tallypine could not load</h1><p>{fatalError}</p><button className="button primary" onClick={() => void reload()}>Try again</button><small>Your database has not been changed. You can also restart Tallypine to use the recovery options.</small></main><ToastStack toasts={toasts} /></div>;
  }

  if (!bootstrap || !settings) return <div className="boot-surface" role="status" aria-label="Loading Tallypine" />;

  if (!settings.onboardingComplete) {
    return <div className="app-frame"><TitleBar /><Onboarding initialCurrency={settings.currencyCode} notify={notify} onComplete={(updated) => { setSettings(updated); setRefreshKey((value) => value + 1); }} /><ToastStack toasts={toasts} /></div>;
  }

  return (
    <div className="app-frame">
      <TitleBar />
      <div className={`content-stage phase-${phase}`} inert={themeOpen ? true : undefined} aria-hidden={themeOpen || undefined}>
        <section className={`app-screen ${screens.dashboard ? "active" : "inactive"}`} aria-hidden={!screens.dashboard}>
          <Dashboard
            data={dashboard} transactions={transactions} settings={settings} selection={selection}
            today={bootstrap.today} minYear={bootstrap.minYear} search={search} kind={kind}
            onSelection={changeSelection} onSearch={setSearch} onKind={(value) => { setKind(value); setPage(0); }} onPage={setPage}
            onAdd={() => setTransactionModal({ open: true, transaction: null })}
            onEdit={(transaction) => setTransactionModal({ open: true, transaction })}
            onDelete={setDeleteTarget}
            onCurrency={() => { currencyReturn.current = "dashboard"; void navigate("currency"); }}
            onThemes={() => setThemeOpen(true)}
            onSettings={() => void navigate("settings")}
            onExport={() => void exportCsv()}
          />
        </section>
        <section className={`app-screen ${screens.settings ? "active" : "inactive"}`} aria-hidden={!screens.settings}>
          <SettingsScreen active={screens.settings} settings={settings} categories={categories} version={bootstrap.version} storageDirectory={bootstrap.storageDirectory} onDone={() => void navigate("dashboard")} onCurrency={() => { currencyReturn.current = "settings"; void navigate("currency"); }} onSettings={setSettings} onReload={reload} notify={notify} />
        </section>
        <section className={`app-screen ${screens.currency ? "active" : "inactive"}`} aria-hidden={!screens.currency}>
          <CurrencyScreen active={screens.currency} selected={settings.currencyCode} onSelect={selectCurrency} onBack={() => void navigate(currencyReturn.current)} />
        </section>
        <div className={`transition-curtain ${phase}`}><img src={logo} alt="" /><span>Loading Tallypine…</span></div>
      </div>
      <ThemePanel open={themeOpen} settings={settings} onSettings={setSettings} onClose={() => setThemeOpen(false)} notify={notify} />
      <TransactionModal open={transactionModal.open} transaction={transactionModal.transaction} categories={categories} today={bootstrap.today} currency={settings.currencyCode} onClose={() => setTransactionModal({ open: false, transaction: null })} onSaved={() => setRefreshKey((value) => value + 1)} notify={notify} />
      <ConfirmModal open={Boolean(deleteTarget)} title="Delete this transaction?" message="This cannot be undone. Your reports and balance will update immediately." confirmLabel="Delete transaction" onCancel={() => setDeleteTarget(null)} onConfirm={removeTransaction} />
      <ToastStack toasts={toasts} />
    </div>
  );
}

function ToastStack({ toasts }: { toasts: Toast[] }) {
  return <div className="toast-stack" aria-live="polite">{toasts.map((toast) => <div key={toast.id} className={`toast ${toast.kind}`}>{toast.message}</div>)}</div>;
}
