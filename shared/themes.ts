import type { ThemeName, ThemePalette } from "./types";

export const DEFAULT_THEME: ThemeName = "Sunshine";

export const THEMES: Record<Exclude<ThemeName, "Custom">, ThemePalette> = {
  Eclipse: {
    mode: "dark",
    bg: "#08111F",
    surface: "#101C2D",
    surfaceAlt: "#152437",
    border: "#24364D",
    text: "#E8F0FA",
    muted: "#8EA1B8",
    accent: "#38BDF8",
    accentHover: "#0EA5E9",
    green: "#2DD4A7",
    red: "#FB7185",
    amber: "#FBBF24",
  },
  Cozy: {
    mode: "dark",
    bg: "#191E17",
    surface: "#262D22",
    surfaceAlt: "#343D2E",
    border: "#53604A",
    text: "#F4E9D8",
    muted: "#B8A993",
    accent: "#C9965B",
    accentHover: "#D7AB75",
    green: "#9BC27E",
    red: "#D9826A",
    amber: "#E2B35D",
  },
  Sunshine: {
    mode: "light",
    bg: "#EAF6FF",
    surface: "#FFFFFF",
    surfaceAlt: "#DDEFFF",
    border: "#B6D5EA",
    text: "#17324D",
    muted: "#526F87",
    accent: "#F2B82B",
    accentHover: "#D99D16",
    green: "#176B51",
    red: "#B73844",
    amber: "#8A5B00",
  },
};

export const THEME_LABELS: Record<Exclude<ThemeName, "Custom">, string> = {
  Eclipse: "Deep navy and crisp blue",
  Cozy: "Pine, warm wood, and soft cream",
  Sunshine: "Light blue, white, and golden accents",
};

export function paletteForTheme(
  name: ThemeName,
  custom: ThemePalette | null,
): ThemePalette {
  if (name === "Custom") return custom ?? { ...THEMES.Cozy };
  return { ...THEMES[name] };
}
