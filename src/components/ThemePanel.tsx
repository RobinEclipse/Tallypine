import { Check, ChevronLeft, GripVertical, MoveHorizontal, Palette, Save, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { AppSettings, ThemeName, ThemePalette } from "../../shared/types";
import { paletteForTheme, THEME_LABELS, THEMES } from "../../shared/themes";
import logo from "../assets/tallypine-logo.png";
import { hexContrast, readableError } from "../lib/format";

interface ThemePanelProps {
  open: boolean;
  settings: AppSettings;
  onSettings(settings: AppSettings): void;
  onClose(): void;
  notify(message: string, kind?: "success" | "error"): void;
}

const COLOR_FIELDS: Array<[keyof Omit<ThemePalette, "mode">, string, string]> = [
  ["bg", "Page background", "The outer application background"],
  ["surface", "Cards", "Main cards and panels"],
  ["surfaceAlt", "Raised controls", "Inputs, buttons, and selected areas"],
  ["border", "Borders", "Lines and card outlines"],
  ["text", "Main text", "Headings and important text"],
  ["muted", "Muted text", "Labels and secondary information"],
  ["accent", "Accent", "Primary actions and highlights"],
  ["accentHover", "Accent hover", "Hover state for primary actions"],
  ["green", "Money In", "Positive amounts"],
  ["red", "Money Out", "Expenses and destructive actions"],
  ["amber", "Net change", "Attention and change values"],
];

type ColorKey = keyof Omit<ThemePalette, "mode">;

interface HslColor {
  h: number;
  s: number;
  l: number;
}

const COLOR_PRESETS = [
  "#08111F", "#17324D", "#FFFFFF", "#EAF6FF",
  "#F2B82B", "#38BDF8", "#14B8A6", "#22C55E",
  "#EF4444", "#F97316", "#A855F7", "#94A3B8",
];

function contrastRatio(first: string, second: string): number {
  const luminance = (hex: string) => {
    const channels = [1, 3, 5]
      .map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255)
      .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export function hexToHsl(hex: string): HslColor {
  const red = Number.parseInt(hex.slice(1, 3), 16) / 255;
  const green = Number.parseInt(hex.slice(3, 5), 16) / 255;
  const blue = Number.parseInt(hex.slice(5, 7), 16) / 255;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const delta = maximum - minimum;
  const lightness = (maximum + minimum) / 2;
  let hue = 0;

  if (delta !== 0) {
    if (maximum === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (maximum === green) hue = 60 * ((blue - red) / delta + 2);
    else hue = 60 * ((red - green) / delta + 4);
  }
  if (hue < 0) hue += 360;

  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  return { h: Math.round(hue), s: Math.round(saturation * 100), l: Math.round(lightness * 100) };
}

export function hslToHex({ h, s, l }: HslColor): string {
  const hue = ((h % 360) + 360) % 360;
  const saturation = Math.max(0, Math.min(100, s)) / 100;
  const lightness = Math.max(0, Math.min(100, l)) / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const section = hue / 60;
  const secondary = chroma * (1 - Math.abs((section % 2) - 1));
  let red = 0;
  let green = 0;
  let blue = 0;

  if (section < 1) [red, green] = [chroma, secondary];
  else if (section < 2) [red, green] = [secondary, chroma];
  else if (section < 3) [green, blue] = [chroma, secondary];
  else if (section < 4) [green, blue] = [secondary, chroma];
  else if (section < 5) [red, blue] = [secondary, chroma];
  else [red, blue] = [chroma, secondary];

  const match = lightness - chroma / 2;
  const channel = (value: number) => Math.round((value + match) * 255).toString(16).padStart(2, "0").toUpperCase();
  return `#${channel(red)}${channel(green)}${channel(blue)}`;
}

function paletteCss(palette: ThemePalette): React.CSSProperties {
  return {
    "--preview-bg": palette.bg,
    "--preview-surface": palette.surface,
    "--preview-alt": palette.surfaceAlt,
    "--preview-border": palette.border,
    "--preview-text": palette.text,
    "--preview-muted": palette.muted,
    "--preview-accent": palette.accent,
    "--preview-accent-hover": palette.accentHover,
    "--preview-green": palette.green,
    "--preview-red": palette.red,
    "--preview-amber": palette.amber,
    "--preview-on-accent": hexContrast(palette.accent),
    "--preview-on-accent-hover": hexContrast(palette.accentHover),
  } as React.CSSProperties;
}

export function ThemePanel({ open, settings, onSettings, onClose, notify }: ThemePanelProps) {
  const [editing, setEditing] = useState(false);
  const [custom, setCustom] = useState<ThemePalette>(() => settings.customTheme ?? { ...THEMES.Cozy });
  const [selectedColor, setSelectedColor] = useState<ColorKey>("bg");
  const [hexDraft, setHexDraft] = useState(custom.bg);
  const [editorWidth, setEditorWidth] = useState(1040);
  const [resizing, setResizing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const drawerRef = useRef<HTMLElement | null>(null);
  const resizeState = useRef<{ pointerId: number; startX: number; startWidth: number } | null>(null);
  const requestId = useRef(0);
  const applyingRef = useRef(false);
  const closeRef = useRef(onClose);
  const editingRef = useRef(editing);
  closeRef.current = onClose;
  editingRef.current = editing;

  useEffect(() => {
    if (settings.customTheme) setCustom(settings.customTheme);
  }, [settings.customTheme]);

  useEffect(() => {
    setHexDraft(custom[selectedColor]);
  }, [custom, selectedColor]);

  useEffect(() => {
    if (!open) setEditing(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => drawerRef.current?.querySelector<HTMLElement>("button")?.focus());
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        if (editingRef.current) setEditing(false);
        else closeRef.current();
        return;
      }
      if (event.key !== "Tab" || !drawerRef.current) return;
      const focusable = [...drawerRef.current.querySelectorAll<HTMLElement>(
        "button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex='-1'])",
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

  useEffect(() => {
    if (!open || !editing) return;
    const frame = window.requestAnimationFrame(() => drawerRef.current?.querySelector<HTMLElement>("[aria-label='Back to theme choices']")?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open, editing]);

  useEffect(() => {
    function move(event: PointerEvent) {
      const state = resizeState.current;
      if (!state || state.pointerId !== event.pointerId) return;
      const maximum = Math.max(0, window.innerWidth - 32);
      const minimum = Math.min(760, maximum);
      setEditorWidth(Math.round(Math.max(minimum, Math.min(maximum, state.startWidth + state.startX - event.clientX))));
    }

    function stop(event: PointerEvent) {
      if (resizeState.current?.pointerId !== event.pointerId) return;
      resizeState.current = null;
      setResizing(false);
    }

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, []);

  async function choose(name: ThemeName) {
    if (applyingRef.current) return;
    if (name === "Custom") {
      setSelectedColor("bg");
      setEditing(true);
      return;
    }
    applyingRef.current = true;
    setApplying(true);
    const currentRequest = ++requestId.current;
    try {
      const updated = await window.tallypine.setTheme(name);
      if (currentRequest === requestId.current) onSettings(updated);
    } catch (error) {
      notify(readableError(error), "error");
    } finally {
      applyingRef.current = false;
      setApplying(false);
    }
  }

  async function saveCustom() {
    setSaving(true);
    try {
      const updated = await window.tallypine.saveCustomTheme(custom);
      onSettings(updated);
      notify("Your custom theme was saved.");
    } catch (error) {
      notify(readableError(error), "error");
    } finally {
      setSaving(false);
    }
  }

  function updateSelectedColor(value: string) {
    setCustom((palette) => ({ ...palette, [selectedColor]: value.toUpperCase() }));
  }

  function selectColor(key: ColorKey) {
    setSelectedColor(key);
    setHexDraft(custom[key]);
  }

  function updateHexDraft(value: string) {
    const next = value.toUpperCase();
    setHexDraft(next);
    if (/^#[0-9A-F]{6}$/.test(next)) updateSelectedColor(next);
  }

  function resizeLimits() {
    const maximum = Math.max(0, window.innerWidth - 32);
    return { minimum: Math.min(760, maximum), maximum };
  }

  function startResize(event: React.PointerEvent<HTMLDivElement>) {
    if (!editing || !drawerRef.current) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeState.current = { pointerId: event.pointerId, startX: event.clientX, startWidth: drawerRef.current.getBoundingClientRect().width };
    setResizing(true);
  }

  function resizeWithKeyboard(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const { minimum, maximum } = resizeLimits();
    const adjustment = event.key === "ArrowLeft" ? 40 : -40;
    setEditorWidth((width) => Math.max(minimum, Math.min(maximum, width + adjustment)));
  }

  const selectedMetadata = COLOR_FIELDS.find(([key]) => key === selectedColor) ?? COLOR_FIELDS[0];
  const selectedHsl = hexToHsl(custom[selectedColor]);
  const contrastIssues = [
    ["Main text on cards", custom.text, custom.surface],
    ["Muted text on cards", custom.muted, custom.surface],
    ["Money In on cards", custom.green, custom.surface],
    ["Money Out on cards", custom.red, custom.surface],
    ["Net Change on cards", custom.amber, custom.surface],
    ["Accent button text", hexContrast(custom.accent), custom.accent],
    ["Accent hover text", hexContrast(custom.accentHover), custom.accentHover],
  ].map(([label, foreground, background]) => ({ label, ratio: contrastRatio(foreground, background) }))
    .filter(({ ratio }) => ratio < 4.5);

  return (
    <>
      <div className={`drawer-scrim ${open ? "open" : ""}`} onMouseDown={onClose} />
      <aside ref={drawerRef} className={`theme-drawer ${editing ? "editing" : ""} ${resizing ? "resizing" : ""} ${open ? "open" : ""}`} style={editing ? { width: `${editorWidth}px` } : undefined} aria-hidden={!open} role="dialog" aria-modal="true" aria-label={editing ? "Custom theme studio" : "Choose a theme"}>
        {editing && <div className="theme-resize-handle" role="separator" aria-label="Resize custom theme studio" aria-orientation="vertical" tabIndex={0} onPointerDown={startResize} onKeyDown={resizeWithKeyboard}><GripVertical size={17} /></div>}
        <div className="drawer-heading">
          <div className="drawer-title">
            {editing ? <button className="icon-button" aria-label="Back to theme choices" onClick={() => setEditing(false)}><ChevronLeft size={19} /></button> : <img src={logo} alt="" />}
            <div><h2>{editing ? "Custom theme studio" : "Choose a theme"}</h2><p>{editing ? "Choose a palette color, then edit it without obstructive popups." : "The menu stays open while you compare."}</p></div>
          </div>
          <div className="drawer-heading-actions">{editing && <span className="theme-size-hint"><MoveHorizontal size={14} /> Drag the left edge to resize</span>}<button className="icon-button" aria-label="Close themes" onClick={onClose}><X size={19} /></button></div>
        </div>

        {!editing ? (
          <div className="theme-list">
            {(Object.keys(THEMES) as Array<Exclude<ThemeName, "Custom">>).map((name) => {
              const palette = THEMES[name];
              return (
                <button key={name} disabled={applying} aria-pressed={settings.themeName === name} className={`theme-option ${settings.themeName === name ? "selected" : ""}`} onClick={() => void choose(name)}>
                  <div className="theme-swatches"><span style={{ background: palette.bg }} /><span style={{ background: palette.surface }} /><span style={{ background: palette.accent }} /><span style={{ background: palette.green }} /></div>
                  <div><strong>{name}</strong><small>{THEME_LABELS[name]}</small></div>
                  {settings.themeName === name && <Check size={18} />}
                </button>
              );
            })}
            <button disabled={applying} aria-pressed={settings.themeName === "Custom"} className={`theme-option ${settings.themeName === "Custom" ? "selected" : ""}`} onClick={() => void choose("Custom")}>
              <div className="custom-theme-icon"><Palette size={21} /></div>
              <div><strong>Custom</strong><small>Build your own detailed palette</small></div>
              {settings.themeName === "Custom" && <Check size={18} />}
            </button>
            <div className="theme-tip"><strong>Instant and stable</strong><p>Themes now use CSS variables. No screens or widgets are rebuilt when colors change.</p></div>
          </div>
        ) : (
          <div className="custom-theme-editor">
            <div className="custom-theme-topbar">
              <div className="custom-toolbar">
                <span>Start from</span>
                {(Object.keys(THEMES) as Array<Exclude<ThemeName, "Custom">>).map((name) => <button key={name} onClick={() => setCustom({ ...THEMES[name] })}>{name}</button>)}
              </div>
              <div className="appearance-control">
                <span className="field-label">Appearance</span>
                <div className="segmented two"><button aria-pressed={custom.mode === "light"} className={custom.mode === "light" ? "active" : ""} onClick={() => setCustom((value) => ({ ...value, mode: "light" }))}>Light</button><button aria-pressed={custom.mode === "dark"} className={custom.mode === "dark" ? "active" : ""} onClick={() => setCustom((value) => ({ ...value, mode: "dark" }))}>Dark</button></div>
              </div>
            </div>

            <div className={`contrast-status ${contrastIssues.length ? "warning" : "good"}`} role="status">
              <strong>{contrastIssues.length ? `${contrastIssues.length} readability warning${contrastIssues.length === 1 ? "" : "s"}` : "Readable color contrast"}</strong>
              <span>{contrastIssues.length ? contrastIssues.map(({ label, ratio }) => `${label} ${ratio.toFixed(1)}:1`).join(" · ") : "All primary text combinations meet the normal-text contrast target."}</span>
            </div>

            <div className="custom-theme-workspace">
              <section className="palette-panel">
                <div className="custom-panel-heading"><div><h3>Interface palette</h3><p>Select the part of Tallypine you want to recolor.</p></div><span>{COLOR_FIELDS.length} colors</span></div>
                <div className="color-field-list">
                  {COLOR_FIELDS.map(([key, label, description]) => (
                    <button type="button" className={`color-field ${selectedColor === key ? "active" : ""}`} key={key} onClick={() => selectColor(key)}>
                      <span className="color-field-swatch" style={{ background: custom[key] }} />
                      <span><strong>{label}</strong><small>{description}</small></span>
                      <code>{custom[key]}</code>
                    </button>
                  ))}
                </div>
              </section>

              <section className="inline-color-editor">
                <div className="custom-panel-heading"><div><h3><SlidersHorizontal size={15} /> Color editor</h3><p>Everything stays visible while you adjust it.</p></div></div>
                <div className="active-color-heading">
                  <span className="active-color-swatch" style={{ background: custom[selectedColor] }} />
                  <div><strong>{selectedMetadata[1]}</strong><small>{selectedMetadata[2]}</small></div>
                  <label className="hex-field"><span>HEX</span><input aria-label="HEX color" value={hexDraft} maxLength={7} onChange={(event) => updateHexDraft(event.target.value)} onBlur={() => setHexDraft(custom[selectedColor])} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} /></label>
                </div>

                <div className="color-preset-grid" aria-label="Quick colors">
                  {COLOR_PRESETS.map((color) => <button type="button" key={color} aria-label={`Use ${color}`} title={color} className={custom[selectedColor] === color ? "active" : ""} style={{ background: color }} onClick={() => updateSelectedColor(color)} />)}
                </div>

                <div className="color-sliders">
                  <label><span>Hue <output>{selectedHsl.h}°</output></span><input aria-label="Hue" type="range" min="0" max="359" value={selectedHsl.h} style={{ accentColor: custom[selectedColor] }} onInput={(event) => updateSelectedColor(hslToHex({ ...selectedHsl, h: Number(event.currentTarget.value) }))} /></label>
                  <label><span>Saturation <output>{selectedHsl.s}%</output></span><input aria-label="Saturation" type="range" min="0" max="100" value={selectedHsl.s} style={{ accentColor: custom[selectedColor] }} onInput={(event) => updateSelectedColor(hslToHex({ ...selectedHsl, s: Number(event.currentTarget.value) }))} /></label>
                  <label><span>Lightness <output>{selectedHsl.l}%</output></span><input aria-label="Lightness" type="range" min="0" max="100" value={selectedHsl.l} style={{ accentColor: custom[selectedColor] }} onInput={(event) => updateSelectedColor(hslToHex({ ...selectedHsl, l: Number(event.currentTarget.value) }))} /></label>
                </div>
              </section>

              <section className="theme-preview-showcase" style={paletteCss(custom)}>
                <div className="custom-panel-heading"><div><h3>Full Tallypine preview</h3><p>Every editable palette color appears somewhere in this example.</p></div><span>Live</span></div>
                <div className="theme-preview-large">
                  <div className="preview-app-toolbar">
                    <div><strong>Tallypine</strong><small>Main text · Muted text</small></div>
                    <div><button className="preview-primary">Accent</button><button className="preview-hover">Accent hover</button></div>
                  </div>
                  <div className="preview-example-grid">
                    <section className="preview-example-card">
                      <div className="preview-section-label">Cards and values</div>
                      <div className="preview-balance"><span>Balance now</span><strong>12,450.00</strong><small>Current total</small></div>
                      <div className="preview-value-grid"><div><span>Money In</span><strong className="positive">+1,250.00</strong></div><div><span>Money Out</span><strong className="negative">−249.00</strong></div><div><span>Net Change</span><strong className="attention">+1,001.00</strong></div></div>
                    </section>
                    <section className="preview-example-card">
                      <div className="preview-section-label">Raised controls and transactions</div>
                      <div className="preview-filter"><button className="active">Month</button><button>Year</button><button>All</button></div>
                      <div className="preview-transaction"><span className="preview-category positive-bg" /><div><strong>Salary payment</strong><small>Money In · Today</small></div><b className="positive">+1,250.00</b></div>
                      <div className="preview-transaction"><span className="preview-category negative-bg" /><div><strong>Monthly subscription</strong><small>Money Out · Yesterday</small></div><b className="negative">−249.00</b></div>
                    </section>
                  </div>
                  <div className="preview-color-key"><span><i className="bg-key" />Page background</span><span><i className="surface-key" />Cards</span><span><i className="alt-key" />Raised controls</span><span><i className="border-key" />Borders</span><span><i className="text-key" />Main text</span><span><i className="muted-key" />Muted text</span><span><i className="accent-key" />Accent</span><span><i className="accent-hover-key" />Accent hover</span><span><i className="green-key" />Money In</span><span><i className="red-key" />Money Out</span><span><i className="amber-key" />Net Change</span></div>
                </div>
              </section>
            </div>
          </div>
        )}
        {editing ? <div className="drawer-footer custom-theme-footer"><button className="button secondary" onClick={() => setEditing(false)}><ChevronLeft size={17} /> Back</button><button className="button primary" disabled={saving} onClick={() => void saveCustom()}><Save size={17} /> {saving ? "Saving…" : "Save and use custom theme"}</button></div> : <div className="drawer-footer"><button className="button primary wide" onClick={onClose}>Done</button></div>}
      </aside>
    </>
  );
}

export function applyPalette(name: ThemeName, custom: ThemePalette | null): void {
  const palette = paletteForTheme(name, custom);
  const root = document.documentElement;
  root.dataset.theme = name;
  root.dataset.mode = palette.mode;
  const values: Record<string, string> = {
    bg: palette.bg,
    surface: palette.surface,
    "surface-alt": palette.surfaceAlt,
    border: palette.border,
    text: palette.text,
    muted: palette.muted,
    accent: palette.accent,
    "accent-hover": palette.accentHover,
    green: palette.green,
    red: palette.red,
    amber: palette.amber,
    "on-accent": hexContrast(palette.accent),
    "on-accent-hover": hexContrast(palette.accentHover),
    "on-red": hexContrast(palette.red),
  };
  for (const [key, value] of Object.entries(values)) root.style.setProperty(`--${key}`, value);
  root.style.colorScheme = palette.mode;
  void window.tallypine?.windowSetBackground(palette.bg).catch(() => undefined);
}
