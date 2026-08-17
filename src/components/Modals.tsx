import { AlertTriangle, CalendarDays, Check, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Category,
  LedgerTransaction,
  SaveCategoryInput,
  SaveTransactionInput,
  TransactionKind,
} from "../../shared/types";
import { formatMoneyInput, readableError } from "../lib/format";

interface TransactionModalProps {
  open: boolean;
  transaction: LedgerTransaction | null;
  categories: Category[];
  today: string;
  currency: string;
  onClose(): void;
  onSaved(): void;
  notify(message: string, kind?: "success" | "error"): void;
}

function amountFromTransaction(transaction: LedgerTransaction | null, currency: string): string {
  return transaction ? formatMoneyInput(transaction.amountUnits, currency) : "";
}

function useDialogFocus(open: boolean, onClose: () => void) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => {
      const preferred = dialogRef.current?.querySelector<HTMLElement>("[autofocus]");
      const fallback = dialogRef.current?.querySelector<HTMLElement>("button, input, select, textarea, [tabindex]:not([tabindex='-1'])");
      (preferred ?? fallback)?.focus();
    });
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(
        "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])",
      )].filter((element) => element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", keydown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", keydown);
      previous?.focus();
    };
  }, [open]);
  return dialogRef;
}

export function TransactionModal({ open, transaction, categories, today, currency, onClose, onSaved, notify }: TransactionModalProps) {
  const [kind, setKind] = useState<TransactionKind>(transaction?.kind ?? "EXPENSE");
  const [date, setDate] = useState(transaction?.transactionDate ?? today);
  const [amount, setAmount] = useState(amountFromTransaction(transaction, currency));
  const [categoryId, setCategoryId] = useState(transaction?.categoryId ?? 0);
  const [description, setDescription] = useState(transaction?.description ?? "");
  const [notes, setNotes] = useState(transaction?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const visibleCategories = useMemo(() => {
    const active = categories.filter((category) => category.kind === kind && category.active);
    if (!transaction?.categoryId || transaction.kind !== kind || active.some((category) => category.id === transaction.categoryId)) return active;
    return [{ id: transaction.categoryId, name: `${transaction.categoryName} (archived)`, kind, color: transaction.categoryColor, active: false }, ...active];
  }, [categories, kind, transaction]);
  const dialogRef = useDialogFocus(open, onClose);

  useEffect(() => {
    if (!open) return;
    const nextKind = transaction?.kind ?? "EXPENSE";
    setKind(nextKind);
    setDate(transaction?.transactionDate ?? today);
    setAmount(amountFromTransaction(transaction, currency));
    setDescription(transaction?.description ?? "");
    setNotes(transaction?.notes ?? "");
    const originalCategoryValid = transaction?.categoryId && transaction.kind === nextKind;
    setCategoryId(originalCategoryValid ? transaction.categoryId! : categories.find((category) => category.kind === nextKind && category.active)?.id ?? 0);
  }, [open, transaction, categories, today, currency]);

  useEffect(() => {
    if (!visibleCategories.some((category) => category.id === categoryId)) setCategoryId(visibleCategories[0]?.id ?? 0);
  }, [visibleCategories, categoryId]);

  if (!open) return null;

  async function save() {
    const input: SaveTransactionInput = {
      id: transaction?.id,
      transactionDate: date,
      kind,
      amount,
      categoryId,
      description,
      notes,
    };
    setSaving(true);
    try {
      await window.tallypine.saveTransaction(input);
      notify(transaction ? "Transaction updated." : "Transaction added.");
      onSaved();
      onClose();
    } catch (error) {
      notify(readableError(error), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section ref={dialogRef} className="modal transaction-modal" role="dialog" aria-modal="true" aria-label={transaction ? "Edit transaction" : "Add transaction"}>
        <div className="modal-heading"><div><h2>{transaction ? "Edit transaction" : "Add transaction"}</h2><p>Record money coming in or going out.</p></div><button className="icon-button" aria-label="Close transaction editor" onClick={onClose}><X size={18} /></button></div>
        <div className="form-grid">
          <div className="field full">
            <span className="field-label">Transaction type</span>
            <div className="segmented two">
              <button aria-pressed={kind === "INCOME"} className={kind === "INCOME" ? "active" : ""} onClick={() => setKind("INCOME")}>Money In</button>
              <button aria-pressed={kind === "EXPENSE"} className={kind === "EXPENSE" ? "active" : ""} onClick={() => setKind("EXPENSE")}>Money Out</button>
            </div>
          </div>
          <label className="field"><span className="field-label">Amount ({currency})</span><input autoFocus inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" /></label>
          <label className="field"><span className="field-label">Date</span><span className="input-with-icon"><CalendarDays size={17} /><input type="date" min="2026-01-01" max={today} value={date} onChange={(event) => setDate(event.target.value)} /></span></label>
          <label className="field full"><span className="field-label">Category</span><select value={categoryId} onChange={(event) => setCategoryId(Number(event.target.value))}>{visibleCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <label className="field full"><span className="field-label">Description</span><input maxLength={120} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What was this transaction for?" /></label>
          <label className="field full"><span className="field-label">Notes <em>optional</em></span><textarea maxLength={2000} rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Add any useful details…" /><small className="character-count">{notes.length}/2,000</small></label>
        </div>
        <div className="modal-actions"><button className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={saving} onClick={() => void save()}><Check size={17} /> {saving ? "Saving…" : "Save transaction"}</button></div>
      </section>
    </div>
  );
}

interface CategoryModalProps {
  open: boolean;
  category: Category | null;
  onClose(): void;
  onSaved(): void;
  notify(message: string, kind?: "success" | "error"): void;
}

const CATEGORY_COLORS = ["#F97316", "#EF4444", "#38BDF8", "#8B5CF6", "#EC4899", "#EAB308", "#14B8A6", "#22C55E", "#A855F7", "#94A3B8"];

export function CategoryModal({ open, category, onClose, onSaved, notify }: CategoryModalProps) {
  const [name, setName] = useState(category?.name ?? "");
  const [kind, setKind] = useState<TransactionKind>(category?.kind ?? "EXPENSE");
  const [color, setColor] = useState(category?.color ?? CATEGORY_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const dialogRef = useDialogFocus(open, onClose);
  useEffect(() => {
    if (!open) return;
    setName(category?.name ?? "");
    setKind(category?.kind ?? "EXPENSE");
    setColor(category?.color ?? CATEGORY_COLORS[0]);
  }, [open, category]);
  if (!open) return null;

  async function save() {
    const input: SaveCategoryInput = { id: category?.id, name, kind, color };
    setSaving(true);
    try {
      await window.tallypine.saveCategory(input);
      notify(category ? "Category updated." : "Category added.");
      onSaved();
      onClose();
    } catch (error) {
      notify(readableError(error), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section ref={dialogRef} className="modal compact-modal" role="dialog" aria-modal="true" aria-label={category ? "Edit category" : "New category"}>
        <div className="modal-heading"><div><h2>{category ? "Edit category" : "New category"}</h2><p>Keep your transaction list organized.</p></div><button className="icon-button" aria-label="Close category editor" onClick={onClose}><X size={18} /></button></div>
        <div className="form-grid">
          <label className="field full"><span className="field-label">Name</span><input autoFocus maxLength={40} value={name} onChange={(event) => setName(event.target.value)} placeholder="Category name" /></label>
          <div className="field full"><span className="field-label">Type</span><div className="segmented two"><button aria-pressed={kind === "INCOME"} disabled={Boolean(category)} className={kind === "INCOME" ? "active" : ""} onClick={() => setKind("INCOME")}>Money In</button><button aria-pressed={kind === "EXPENSE"} disabled={Boolean(category)} className={kind === "EXPENSE" ? "active" : ""} onClick={() => setKind("EXPENSE")}>Money Out</button></div></div>
          <div className="field full"><span className="field-label">Color</span><div className="color-choices">{CATEGORY_COLORS.map((choice) => <button key={choice} className={choice === color ? "active" : ""} style={{ background: choice }} onClick={() => setColor(choice)} aria-label={`Use ${choice}`} />)}<label className="custom-color"><input type="color" value={color} onChange={(event) => setColor(event.target.value.toUpperCase())} /><span>Custom</span></label></div></div>
        </div>
        <div className="modal-actions"><button className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={saving} onClick={() => void save()}><Check size={17} /> Save category</button></div>
      </section>
    </div>
  );
}

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onCancel(): void;
  onConfirm(): void | Promise<void>;
}

export function ConfirmModal({ open, title, message, confirmLabel, danger = true, onCancel, onConfirm }: ConfirmModalProps) {
  const [working, setWorking] = useState(false);
  const dialogRef = useDialogFocus(open, onCancel);
  if (!open) return null;
  async function confirm() {
    setWorking(true);
    try { await onConfirm(); } finally { setWorking(false); }
  }
  return (
    <div className="modal-backdrop alert-backdrop">
      <section ref={dialogRef} className="modal confirm-modal" role="alertdialog" aria-modal="true" aria-label={title}>
        <div className={`alert-icon ${danger ? "danger" : "warning"}`}><AlertTriangle size={22} /></div>
        <h2>{title}</h2><p>{message}</p>
        <div className="modal-actions"><button className="button secondary" onClick={onCancel}>Cancel</button><button className={`button ${danger ? "danger" : "primary"}`} disabled={working} onClick={() => void confirm()}>{working ? "Working…" : confirmLabel}</button></div>
      </section>
    </div>
  );
}
