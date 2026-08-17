import { describe, expect, it } from "vitest";
import { currencyFractionDigits, MONEY_SCALE } from "../shared/money";
import { formatMoney, formatMoneyInput } from "../src/lib/format";

describe("currency-aware money formatting", () => {
  it("uses ISO currency precision for zero-, two-, three-, and four-decimal currencies", () => {
    expect(currencyFractionDigits("JPY")).toBe(0);
    expect(currencyFractionDigits("NOK")).toBe(2);
    expect(currencyFractionDigits("KWD")).toBe(3);
    expect(currencyFractionDigits("CLF")).toBe(4);
  });

  it("formats scaled values without losing stored precision after a currency-label change", () => {
    expect(formatMoney(123 * MONEY_SCALE, "JPY")).toBe("123 JPY");
    expect(formatMoney(12_340, "KWD")).toBe("1.234 KWD");
    expect(formatMoney(1_234_500, "JPY")).toBe("123.45 JPY");
    expect(formatMoneyInput(1_234_500, "JPY")).toBe("123.45");
  });
});
