import type { PeriodSelection } from "../../shared/types";
import { displayFractionDigits, MONEY_SCALE } from "../../shared/money";

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function formatMoney(units: number, currency: string, signed = false): string {
  const absolute = Math.abs(units) / MONEY_SCALE;
  const fractionDigits = displayFractionDigits(units, currency);
  const number = new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(absolute);
  const sign = signed ? (units > 0 ? "+" : units < 0 ? "−" : "") : units < 0 ? "−" : "";
  return `${sign}${number} ${currency}`;
}

export function formatShortMoney(units: number, currency: string): string {
  const value = Math.abs(units) / MONEY_SCALE;
  const sign = units < 0 ? "−" : "";
  if (value >= 1_000_000) return `${sign}${(value / 1_000_000).toFixed(1)}m ${currency}`;
  if (value >= 10_000) return `${sign}${(value / 1_000).toFixed(1)}k ${currency}`;
  return formatMoney(units, currency);
}

export function formatMoneyInput(units: number, currency: string): string {
  return (units / MONEY_SCALE).toFixed(displayFractionDigits(units, currency));
}

export function readableError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/^Error invoking remote method '[^']+': Error:\s*/i, "");
}

export function todayParts(today: string): { year: number; month: number; day: number } {
  const [year, month, day] = today.split("-").map(Number);
  return { year, month, day };
}

function localDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function isoWeekNumber(value: Date): number {
  const date = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const day = date.getDay() || 7;
  date.setDate(date.getDate() + 4 - day);
  const start = new Date(date.getFullYear(), 0, 1);
  return Math.ceil(((date.getTime() - start.getTime()) / 86_400_000 + 1) / 7);
}

export function isoWeekYear(value: Date): number {
  const date = new Date(value);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() + 4 - day);
  return date.getFullYear();
}

export function yearsFor(period: "week" | "month" | "year", today: string, minYear: number): number[] {
  const date = localDate(today);
  const maximum = period === "week" ? isoWeekYear(date) : date.getFullYear();
  return Array.from({ length: Math.max(0, maximum - minYear + 1) }, (_, index) => maximum - index);
}

export function monthsFor(year: number, today: string, minYear: number): number[] {
  const current = localDate(today);
  if (year < minYear || year > current.getFullYear()) return [];
  const maximum = year === current.getFullYear() ? current.getMonth() + 1 : 12;
  return Array.from({ length: maximum }, (_, index) => index + 1);
}

export function weeksFor(year: number, today: string, minYear: number): number[] {
  const current = localDate(today);
  const maximumYear = isoWeekYear(current);
  if (year < minYear || year > maximumYear) return [];
  const maximum = year === maximumYear ? isoWeekNumber(current) : isoWeekNumber(new Date(year, 11, 28));
  return Array.from({ length: maximum }, (_, index) => index + 1);
}

export function defaultSelection(today: string): PeriodSelection {
  const { year, month } = todayParts(today);
  return { period: "month", year, month };
}

export function formatTransactionDate(value: string): string {
  return localDate(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function hexContrast(color: string): string {
  const channels = [1, 3, 5]
    .map((index) => Number.parseInt(color.slice(index, index + 2), 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  const darkContrast = (luminance + 0.05) / 0.056;
  const lightContrast = 1.05 / (luminance + 0.05);
  return darkContrast >= lightContrast ? "#08111F" : "#FFFFFF";
}
