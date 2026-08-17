import {
  Archive,
  ArrowLeft,
  CircleDollarSign,
  Database,
  Edit3,
  FolderDown,
  FolderUp,
  Info,
  Plus,
  Save,
  SlidersHorizontal,
  Tags,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { currencyInfo } from "../../shared/currencies";
import type { AppSettings, Category } from "../../shared/types";
import logo from "../assets/tallypine-logo.png";
import { formatMoneyInput, readableError } from "../lib/format";
import { CategoryModal, ConfirmModal } from "./Modals";

type SettingsTab = "general" | "categories" | "data";

interface SettingsScreenProps {
  active: boolean;
  settings: AppSettings;
  categories: Category[];
  version: string;
  storageDirectory: string;
  onDone(): void;
  onCurrency(): void;
  onSettings(settings: AppSettings): void;
  onReload(): Promise<void> | void;
  notify(message: string, kind?: "success" | "error"): void;
}

export function SettingsScreen({ settings, categories, version, storageDirectory, onDone, onCurrency, onSettings, onReload, notify }: SettingsScreenProps) {
  const displayVersion = version.replace(/\.0$/, "");
  const [tab, setTab] = useState<SettingsTab>("general");
  const [balance, setBalance] = useState(formatMoneyInput(settings.startingBalanceUnits, settings.currencyCode));
  const [categoryModal, setCategoryModal] = useState<{ open: boolean; category: Category | null }>({ open: false, category: null });
  const [archiveTarget, setArchiveTarget] = useState<Category | null>(null);
  const [restoreConfirm, setRestoreConfirm] = useState(false);
  const currency = useMemo(() => currencyInfo(settings.currencyCode), [settings.currencyCode]);

  useEffect(() => setBalance(formatMoneyInput(settings.startingBalanceUnits, settings.currencyCode)), [settings.startingBalanceUnits, settings.currencyCode]);

  async function saveBalance() {
    try {
      const updated = await window.tallypine.setStartingBalance(balance);
      onSettings(updated);
      setBalance(formatMoneyInput(updated.startingBalanceUnits, updated.currencyCode));
      notify("Your starting balance was updated.");
      await onReload();
    } catch (error) { notify(readableError(error), "error"); }
  }

  async function archiveCategory() {
    if (!archiveTarget) return;
    try {
      await window.tallypine.archiveCategory(archiveTarget.id);
      notify("Category archived. Existing transactions keep their category.");
      setArchiveTarget(null);
      await onReload();
    } catch (error) { notify(readableError(error), "error"); }
  }

  async function backup() {
    try {
      const result = await window.tallypine.createBackup();
      if (!result.canceled) notify(result.message ?? "Backup saved.");
    } catch (error) { notify(readableError(error), "error"); }
  }

  async function restore() {
    setRestoreConfirm(false);
    try {
      const result = await window.tallypine.restoreBackup();
      if (!result.canceled) {
        await onReload();
        notify(result.message ?? "Backup restored.");
      }
    } catch (error) { notify(readableError(error), "error"); }
  }

  const grouped = {
    EXPENSE: categories.filter((category) => category.kind === "EXPENSE"),
    INCOME: categories.filter((category) => category.kind === "INCOME"),
  };

  return (
    <div className="standalone-screen settings-screen">
      <div className="screen-heading settings-heading">
        <button className="icon-text-button" onClick={onDone}><ArrowLeft size={17} /> Done</button>
        <div className="heading-copy"><img src={logo} alt="Tallypine" /><div><h1>Settings</h1><p>Manage your balance, categories, and local data.</p></div></div>
      </div>
      <div className="settings-layout">
        <nav className="settings-nav card">
          <button className={tab === "general" ? "active" : ""} onClick={() => setTab("general")}><SlidersHorizontal size={18} /><span><strong>General</strong><small>Balance and currency</small></span></button>
          <button className={tab === "categories" ? "active" : ""} onClick={() => setTab("categories")}><Tags size={18} /><span><strong>Categories</strong><small>Organize transactions</small></span></button>
          <button className={tab === "data" ? "active" : ""} onClick={() => setTab("data")}><Database size={18} /><span><strong>Data & backup</strong><small>Export and restore</small></span></button>
          <div className="settings-version"><img src={logo} alt="" /><span>Tallypine <strong>{displayVersion}</strong><small>Private · Offline · No account</small></span></div>
        </nav>

        <section className="settings-content card">
          {tab === "general" && (
            <div className="settings-section">
              <div className="section-title"><h2>General</h2><p>The starting point and display currency for your ledger.</p></div>
               <div className="setting-block"><div className="setting-copy"><strong>Starting balance</strong><p>The balance you had before your first recorded transaction.</p></div><div className="balance-setting"><label className="input-suffix"><input aria-label="Starting balance" value={balance} inputMode="decimal" onChange={(event) => setBalance(event.target.value)} /><span>{settings.currencyCode}</span></label><button className="button primary" onClick={() => void saveBalance()}><Save size={16} /> Save</button></div></div>
              <div className="setting-block"><div className="setting-copy"><strong>Display currency</strong><p>Changes the label throughout Tallypine. Existing amounts are not converted.</p></div><button className="currency-setting" onClick={onCurrency}><span className="setting-icon"><CircleDollarSign size={20} /></span><span><strong>{settings.currencyCode} · {currency.name}</strong><small>{currency.territory}</small></span><em>Change</em></button></div>
              <div className="info-panel"><Info size={18} /><p>Transaction dates begin at <strong>2026</strong>. Future dates are blocked, and new months and years unlock automatically as time passes.</p></div>
            </div>
          )}

          {tab === "categories" && (
            <div className="settings-section categories-section">
              <div className="section-title row"><div><h2>Categories</h2><p>Add, rename, recolor, or archive transaction categories.</p></div><button className="button primary" onClick={() => setCategoryModal({ open: true, category: null })}><Plus size={16} /> New category</button></div>
              {(["EXPENSE", "INCOME"] as const).map((kind) => <div className="category-group" key={kind}><h3>{kind === "EXPENSE" ? "Money Out" : "Money In"}<span>{grouped[kind].length}</span></h3><div className="category-list">{grouped[kind].map((category) => <article key={category.id} className="category-row"><span className="category-color" style={{ background: category.color }} /><strong>{category.name}</strong><button title="Edit category" onClick={() => setCategoryModal({ open: true, category })}><Edit3 size={15} /> Edit</button><button title="Archive category" onClick={() => setArchiveTarget(category)}><Archive size={15} /> Archive</button></article>)}</div></div>)}
              <div className="info-panel"><Info size={18} /><p>Archived categories remain attached to older transactions, so your reports stay accurate.</p></div>
            </div>
          )}

          {tab === "data" && (
            <div className="settings-section">
              <div className="section-title"><h2>Data & backup</h2><p>Your transactions stay in a local SQLite database on this PC.</p></div>
              <div className="data-card"><span className="data-icon"><FolderDown size={24} /></span><div><strong>Create a complete backup</strong><p>Saves transactions, categories, balance, currency, and themes in one <code>.tpbackup</code> file.</p></div><button className="button secondary" onClick={() => void backup()}>Create backup</button></div>
              <div className="data-card"><span className="data-icon warning"><FolderUp size={24} /></span><div><strong>Restore a backup</strong><p>Checks the selected file before replacing the current local data.</p></div><button className="button secondary" onClick={() => setRestoreConfirm(true)}>Restore backup</button></div>
              <div className="privacy-card"><Database size={20} /><div><strong>Stored only on this PC</strong><p>No login, cloud service, analytics, or internet connection is used. Files inherit your Windows account permissions but are not password-encrypted. Current data folder: <code>{storageDirectory}</code></p></div></div>
            </div>
          )}
        </section>
      </div>
      <CategoryModal open={categoryModal.open} category={categoryModal.category} onClose={() => setCategoryModal({ open: false, category: null })} onSaved={onReload} notify={notify} />
      <ConfirmModal open={Boolean(archiveTarget)} title="Archive this category?" message="It will disappear from new transactions but remain attached to older ones." confirmLabel="Archive category" onCancel={() => setArchiveTarget(null)} onConfirm={archiveCategory} />
      <ConfirmModal open={restoreConfirm} title="Restore a backup?" message="The chosen backup will replace the transactions and settings currently in Tallypine. A file picker opens next." confirmLabel="Choose backup" danger={false} onCancel={() => setRestoreConfirm(false)} onConfirm={restore} />
    </div>
  );
}
