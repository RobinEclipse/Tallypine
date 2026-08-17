export const MONEY_SCALE = 10_000;
export const MONEY_SCALE_DIGITS = 4;

export function currencyFractionDigits(code: string): number {
  try {
    const digits = new Intl.NumberFormat("en", {
      style: "currency",
      currency: code,
    }).resolvedOptions().maximumFractionDigits ?? 2;
    return Math.max(0, Math.min(MONEY_SCALE_DIGITS, digits));
  } catch {
    return 2;
  }
}

export function storedFractionDigits(value: number): number {
  let remainder = Math.abs(Math.trunc(value)) % MONEY_SCALE;
  if (remainder === 0) return 0;
  let digits = MONEY_SCALE_DIGITS;
  while (digits > 0 && remainder % 10 === 0) {
    remainder /= 10;
    digits -= 1;
  }
  return digits;
}

export function displayFractionDigits(value: number, currency: string): number {
  return Math.max(currencyFractionDigits(currency), storedFractionDigits(value));
}
