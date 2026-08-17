import { ArrowRight, CheckCircle2, CircleDollarSign, LockKeyhole } from "lucide-react";
import { useState } from "react";
import { currencyInfo } from "../../shared/currencies";
import type { AppSettings } from "../../shared/types";
import logo from "../assets/tallypine-logo.png";
import { readableError } from "../lib/format";
import { CurrencyScreen } from "./CurrencyScreen";

interface OnboardingProps {
  initialCurrency: string;
  onComplete(settings: AppSettings): void;
  notify(message: string, kind?: "success" | "error"): void;
}

export function Onboarding({ initialCurrency, onComplete, notify }: OnboardingProps) {
  const [currency, setCurrency] = useState(initialCurrency || "NOK");
  const [balance, setBalance] = useState("0.00");
  const [choosing, setChoosing] = useState(false);
  const [saving, setSaving] = useState(false);
  const info = currencyInfo(currency);

  async function start() {
    setSaving(true);
    try {
      const settings = await window.tallypine.completeOnboarding(currency, balance);
      onComplete(settings);
    } catch (error) {
      notify(readableError(error), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="onboarding-shell">
      <div className={`onboarding-page ${choosing ? "hidden" : "visible"}`}>
        <div className="welcome-hero">
          <img src={logo} alt="Tallypine" />
          <div><span>TALLYPINE 1.0</span><h1>Welcome to Tallypine</h1><p>A calmer way to track every transaction, privately and completely offline.</p></div>
        </div>
        <div className="welcome-card card">
          <div className="welcome-copy"><h2>Set up your ledger</h2><p>Choose how amounts should appear and enter the balance you have now. Both can be changed later.</p></div>
          <button className="onboarding-choice" onClick={() => setChoosing(true)}><span className="setting-icon"><CircleDollarSign size={22} /></span><span><small>CURRENCY</small><strong>{currency} · {info.name}</strong><em>{info.territory}</em></span><ArrowRight size={18} /></button>
          <label className="field"><span className="field-label">Starting balance</span><span className="input-suffix large"><input aria-label="Starting balance" value={balance} inputMode="decimal" onChange={(event) => setBalance(event.target.value)} /><span>{currency}</span></span><small>This begins at 0.00 unless you change it.</small></label>
          <div className="welcome-reassurance"><span><LockKeyhole size={17} /> No account needed</span><span><CheckCircle2 size={17} /> Your data stays on this PC</span></div>
          <button className="button primary welcome-start" disabled={saving} onClick={() => void start()}>{saving ? "Starting…" : "Start using Tallypine"}<ArrowRight size={18} /></button>
        </div>
      </div>
      <div className={`onboarding-currency ${choosing ? "visible" : "hidden"}`}>
        <CurrencyScreen active={choosing} selected={currency} title="Choose your starting currency" onBack={() => setChoosing(false)} onSelect={(code) => { setCurrency(code); setChoosing(false); }} />
      </div>
    </div>
  );
}
