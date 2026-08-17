import { describe, expect, it } from "vitest";
import { THEMES } from "../shared/themes";
import { hexToHsl, hslToHex } from "../src/components/ThemePanel";
import { hexContrast } from "../src/lib/format";

function contrastRatio(first: string, second: string): number {
  const luminance = (hex: string) => {
    const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255)
      .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe("custom theme color conversion", () => {
  it("converts primary HEX colors to readable HSL controls", () => {
    expect(hexToHsl("#FF0000")).toEqual({ h: 0, s: 100, l: 50 });
    expect(hexToHsl("#00FF00")).toEqual({ h: 120, s: 100, l: 50 });
    expect(hexToHsl("#0000FF")).toEqual({ h: 240, s: 100, l: 50 });
  });

  it("converts slider values back to normalized uppercase HEX", () => {
    expect(hslToHex({ h: 0, s: 100, l: 50 })).toBe("#FF0000");
    expect(hslToHex({ h: 120, s: 100, l: 50 })).toBe("#00FF00");
    expect(hslToHex({ h: 240, s: 100, l: 50 })).toBe("#0000FF");
  });

  it("clamps out-of-range saturation and lightness values", () => {
    expect(hslToHex({ h: 360, s: 140, l: 50 })).toBe("#FF0000");
    expect(hslToHex({ h: 0, s: 100, l: -20 })).toBe("#000000");
  });

  it("keeps all built-in small-text colors readable on cards", () => {
    for (const palette of Object.values(THEMES)) {
      for (const foreground of [palette.text, palette.muted, palette.green, palette.red, palette.amber]) {
        expect(contrastRatio(foreground, palette.surface)).toBeGreaterThanOrEqual(4.5);
      }
      expect(contrastRatio(hexContrast(palette.accent), palette.accent)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(hexContrast(palette.accentHover), palette.accentHover)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
