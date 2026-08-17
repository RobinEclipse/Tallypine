import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Download,
  Edit3,
  Layers3,
  Palette,
  Plus,
  Search,
  Settings,
  Trash2,
  WalletCards,
} from "lucide-react";
import type {
  AppSettings,
  DashboardData,
  LedgerTransaction,
  PeriodKind,
  PeriodSelection,
  TransactionKind,
  TransactionPage,
} from "../../shared/types";
import logo from "../assets/tallypine-logo.png";
import {
  formatMoney,
  formatTransactionDate,
  isoWeekNumber,
  isoWeekYear,
  MONTHS,
  monthsFor,
  todayParts,
  weeksFor,
  yearsFor,
} from "../lib/format";
import { BalanceChart, SpendingChart } from "./Charts";

interface DashboardProps {
  data: DashboardData | null;
  transactions: TransactionPage | null;
  settings: AppSettings;
  selection: PeriodSelection;
  today: string;
  minYear: number;
  search: string;
  kind: TransactionKind | null;
  onSelection(selection: PeriodSelection): void;
  onSearch(value: string): void;
  onKind(value: TransactionKind | null): void;
  onPage(value: number): void;
  onAdd(): void;
  onEdit(transaction: LedgerTransaction): void;
  onDelete(transaction: LedgerTransaction): void;
  onCurrency(): void;
  onThemes(): void;
  onSettings(): void;
  onExport(): void;
}

function StatCard({ className, title, value, subtitle, icon }: { className: string; title: string; value: string; subtitle: string; icon: React.ReactNode }) {
  return <article className={`stat-card ${className}`}><div className="stat-title"><span>{title}</span>{icon}</div><strong>{value}</strong><small>{subtitle}</small></article>;
}

function TransactionRow({ transaction, currency, onEdit, onDelete }: { transaction: LedgerTransaction; currency: string; onEdit(): void; onDelete(): void }) {
  const incoming = transaction.kind === "INCOME";
  return (
    <article className="transaction-row">
      <span className="category-stripe" style={{ background: transaction.categoryColor }} />
      <div className={`transaction-kind-icon ${incoming ? "income" : "expense"}`}>{incoming ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}</div>
      <div className="transaction-copy"><strong>{transaction.description}</strong><span>{transaction.categoryName} · {formatTransactionDate(transaction.transactionDate)}</span></div>
      <strong className={incoming ? "money-in" : "money-out"}>{incoming ? "+" : "−"}{formatMoney(transaction.amountUnits, currency)}</strong>
      <div className="row-actions"><button title="Edit transaction" onClick={onEdit}><Edit3 size={15} /></button><button title="Delete transaction" onClick={onDelete}><Trash2 size={15} /></button></div>
    </article>
  );
}

export function Dashboard(props: DashboardProps) {
  const {
    data, transactions, settings, selection, today, minYear, search, kind,
    onSelection, onSearch, onKind, onPage, onAdd, onEdit, onDelete,
    onCurrency, onThemes, onSettings, onExport,
  } = props;
  const current = todayParts(today);
  const currency = settings.currencyCode;
  const summary = data?.summary;
  const period = selection.period;

  function changePeriod(value: PeriodKind) {
    if (value === "all") return onSelection({ period: "all" });
    if (value === "week") {
      const date = new Date(current.year, current.month - 1, current.day);
      return onSelection({ period: "week", year: isoWeekYear(date), week: isoWeekNumber(date) });
    }
    if (value === "year") return onSelection({ period: "year", year: current.year });
    onSelection({ period: "month", year: current.year, month: current.month });
  }

  const years = period === "all" ? [] : yearsFor(period, today, minYear);
  const selectedYear = selection.year ?? years[0] ?? current.year;
  const details = period === "month" ? monthsFor(selectedYear, today, minYear) : period === "week" ? weeksFor(selectedYear, today, minYear) : [];

  function changeYear(year: number) {
    if (period === "month") {
      const months = monthsFor(year, today, minYear);
      onSelection({ period, year, month: months.includes(selection.month ?? -1) ? selection.month : months.at(-1) });
    } else if (period === "week") {
      const weeks = weeksFor(year, today, minYear);
      onSelection({ period, year, week: weeks.includes(selection.week ?? -1) ? selection.week : weeks.at(-1) });
    } else onSelection({ period: "year", year });
  }

  return (
    <div className="dashboard-screen">
      <header className="app-toolbar">
        <div className="app-brand"><img src={logo} alt="Tallypine" /><div><h1>Tallypine</h1><p>Your private, offline transaction tracker</p></div></div>
        <div className="toolbar-actions">
          <button className="button primary" aria-label="Add transaction" title="Add transaction" onClick={onAdd}><Plus size={17} /><span>Add transaction</span></button>
          <div className="toolbar-tools">
            <button className="toolbar-tool currency-button" aria-label={`${currency} · Change currency`} title="Change currency" onClick={onCurrency}><CircleDollarSign size={17} /><span>{currency} · Currency</span></button>
            <button className="toolbar-tool" aria-label="Export CSV" title="Export CSV" onClick={onExport}><Download size={17} /><span>Export</span></button>
            <button className="toolbar-tool" aria-label="Themes" title="Themes" onClick={onThemes}><Palette size={17} /><span>Themes</span></button>
            <button className="toolbar-tool" aria-label="Settings" title="Settings" onClick={onSettings}><Settings size={17} /><span>Settings</span></button>
          </div>
        </div>
      </header>

      <div className="dashboard-scroll">
        <main className="dashboard-layout">
          <section className="overview-grid">
            <section className="transactions-card card">
              <div className="card-heading transaction-heading"><div><h2>Transactions</h2><p>{transactions ? `${transactions.total} transaction${transactions.total === 1 ? "" : "s"} in this period` : "Loading transactions…"}</p></div></div>
              <div className="transaction-filters">
                <label className="search-box"><Search size={17} /><input aria-label="Search transactions" value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search transactions…" /></label>
                <select aria-label="Filter transaction type" value={kind ?? "ALL"} onChange={(event) => onKind(event.target.value === "ALL" ? null : event.target.value as TransactionKind)}><option value="ALL">All types</option><option value="INCOME">Money In</option><option value="EXPENSE">Money Out</option></select>
              </div>
              <div className="transaction-list">
                {transactions?.rows.map((transaction) => <TransactionRow key={transaction.id} transaction={transaction} currency={currency} onEdit={() => onEdit(transaction)} onDelete={() => onDelete(transaction)} />)}
                {transactions && !transactions.rows.length && <div className="empty-list"><strong>No transactions found</strong><span>Add one or adjust the current filters.</span></div>}
              </div>
              {transactions && transactions.pageCount > 1 && <div className="pagination"><button disabled={transactions.page === 0} onClick={() => onPage(transactions.page - 1)}><ChevronLeft size={16} /> Previous</button><span>Page {transactions.page + 1} of {transactions.pageCount}</span><button disabled={transactions.page + 1 >= transactions.pageCount} onClick={() => onPage(transactions.page + 1)}>Next <ChevronRight size={16} /></button></div>}
            </section>

            <aside className="summary-card card">
              <div className="card-heading summary-heading"><div><h2>Summary</h2><p>Your balance and selected-period totals</p></div></div>
              <div className="stats-grid">
                <StatCard className="balance" title="BALANCE NOW" value={summary ? formatMoney(summary.currentBalanceUnits, currency) : "—"} subtitle="Current total" icon={<WalletCards size={18} />} />
                <StatCard className="income" title="MONEY IN" value={summary ? formatMoney(summary.incomeUnits, currency) : "—"} subtitle="Selected period" icon={<ArrowDownLeft size={18} />} />
                <StatCard className="net" title="NET CHANGE" value={summary ? formatMoney(summary.netUnits, currency, true) : "—"} subtitle="Money in minus money out" icon={<Layers3 size={18} />} />
                <StatCard className="expense" title="MONEY OUT" value={summary ? formatMoney(summary.expenseUnits, currency) : "—"} subtitle="Selected period" icon={<ArrowUpRight size={18} />} />
              </div>
            </aside>
          </section>

          <section className="reporting-card card">
            <div className="report-label"><span>REPORTING PERIOD</span><strong>{data?.range.label ?? "Loading…"}</strong></div>
            <div className="segmented four">{(["week", "month", "year", "all"] as PeriodKind[]).map((value) => <button key={value} aria-pressed={period === value} className={period === value ? "active" : ""} onClick={() => changePeriod(value)}>{value[0].toUpperCase() + value.slice(1)}</button>)}</div>
            <div className="report-details">
              {period !== "all" ? <div className="period-details"><select aria-label="Reporting year" value={selectedYear} onChange={(event) => changeYear(Number(event.target.value))}>{years.map((year) => <option key={year} value={year}>{year}</option>)}</select>{period === "month" && <select aria-label="Reporting month" value={selection.month} onChange={(event) => onSelection({ period, year: selectedYear, month: Number(event.target.value) })}>{details.map((month) => <option key={month} value={month}>{MONTHS[month - 1]}</option>)}</select>}{period === "week" && <select aria-label="Reporting week" value={selection.week} onChange={(event) => onSelection({ period, year: selectedYear, week: Number(event.target.value) })}>{details.map((week) => <option key={week} value={week}>Week {week}</option>)}</select>}</div> : <span className="all-period-copy">All recorded transactions</span>}
            </div>
          </section>

          <section className="analytics-grid">
            <section className="chart-card card spending-card"><div className="card-heading"><div><h2>Spending by category</h2><p>Where your money went</p></div></div><SpendingChart rows={data?.categorySpending ?? []} currency={currency} /></section>
            <section className="chart-card card balance-card"><div className="card-heading"><div><h2>Balance over time</h2><p>Running balance in the selected period</p></div></div><BalanceChart points={data?.balanceSeries ?? []} currency={currency} /></section>
          </section>
        </main>
      </div>
    </div>
  );
}
