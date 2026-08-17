import { ArrowLeft, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CURRENCIES } from "../../shared/currencies";
import logo from "../assets/tallypine-logo.png";

interface CurrencyScreenProps {
  active: boolean;
  selected: string;
  onSelect(code: string): Promise<void> | void;
  onBack(): void;
  title?: string;
}

const PAGE_SIZE = 20;

export function CurrencyScreen({ active, selected, onSelect, onBack, title = "Choose your currency" }: CurrencyScreenProps) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const matches = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return CURRENCIES;
    return CURRENCIES.filter(({ code, name, territory }) => `${code} ${name} ${territory}`.toLocaleLowerCase().includes(query));
  }, [search]);
  const searching = Boolean(search.trim());
  const pageCount = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const visible = searching ? matches.slice(0, PAGE_SIZE) : matches.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useEffect(() => setPage(0), [search]);
  useEffect(() => {
    if (active) window.setTimeout(() => searchRef.current?.focus(), 420);
  }, [active]);

  return (
    <div className="standalone-screen currency-screen">
      <div className="screen-heading">
        <button className="icon-text-button" onClick={onBack}><ArrowLeft size={17} /> Back</button>
        <div className="heading-copy">
          <img src={logo} alt="Tallypine" />
          <div><h1>{title}</h1><p>Browse 20 at a time, or search directly by code, currency, or country.</p></div>
        </div>
      </div>
      <div className="currency-panel card">
        <label className="search-box">
          <Search size={18} />
          <input ref={searchRef} aria-label="Search currencies or countries" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search currencies or countries…" />
        </label>
        <div className="results-copy">
          {searching
            ? `${matches.length} direct match${matches.length === 1 ? "" : "es"}${matches.length > PAGE_SIZE ? ` · showing the first ${PAGE_SIZE}` : ""}`
            : `Showing ${matches.length ? page * PAGE_SIZE + 1 : 0}–${Math.min((page + 1) * PAGE_SIZE, matches.length)} of ${matches.length} currencies`}
        </div>
        <div className="currency-list">
          {visible.map((currency) => (
            <button
              key={currency.code}
              className={`currency-row ${currency.code === selected ? "selected" : ""}`}
              aria-pressed={currency.code === selected}
              onClick={() => void onSelect(currency.code)}
            >
              <span className="currency-code">{currency.code}</span>
              <span className="currency-name">{currency.name}</span>
              <span className="currency-country">{currency.territory}</span>
              <span className="currency-check">{currency.code === selected ? "✓" : ""}</span>
            </button>
          ))}
          {!visible.length && <div className="empty-list">No currencies match that search.</div>}
        </div>
        {!searching && (
          <div className="pagination currency-pagination">
            <button disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}><ChevronLeft size={16} /> Previous</button>
            <span>Page {page + 1} of {pageCount}</span>
            <button disabled={page + 1 >= pageCount} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}>Next <ChevronRight size={16} /></button>
          </div>
        )}
      </div>
    </div>
  );
}
