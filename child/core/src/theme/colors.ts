/*
 * The viewer's colours. Every part of the viewer takes its colours from here: the shell through the CSS variables
 * uiVariables() gives (apply.ts puts them on the page, and ../styles.css makes them Tailwind colours: bg-panel,
 * text-ink, …), and engines such as the piping diagrams by importing them (../pipeline/view/theme.ts adds only
 * their own). So a change here shows everywhere. A ship's theme can replace the accent (see ../customize/types.ts).
 */

/** The UI colours: charcoal for accents and highlights, dark blue-gray for text, and three from Colour Palette #4815. */
export const PALETTE = {
  charcoal: "#242121",
  darkBlueGray: "#3b4f5c",
  grayBlue: "#a1c0c2",
  grayViolet: "#e6e7eb",
  white: "#f6f6f6",
} as const;

/**
 * What each UI colour is used for. Each one is also a CSS variable (panel2 is --panel-2) and, if
 * ../styles.css lists it, a Tailwind colour of the same name (bg-panel-2, border-line, text-ink).
 */
export const UI = {
  /** The page and the diagram background, the 3D floor too. */
  page: PALETTE.grayViolet,
  /** Sidebar, top bar, info panel, tooltips and callouts. */
  panel: PALETTE.white,
  /** Buttons, cards and bar tracks on a panel. */
  panel2: PALETTE.grayViolet,
  hover: PALETTE.grayViolet,
  /** Borders, dividers and switch tracks. */
  line: PALETTE.grayBlue,
  /** All text, on the page and on the diagram. */
  ink: PALETTE.darkBlueGray,
  muted: PALETTE.darkBlueGray,
  /** The section's main heading in the top bar. */
  heading: PALETTE.charcoal,
  /** The active sidebar item and the "on" switches and toggles. */
  accent: PALETTE.charcoal,
  /** Text and knobs on the accent colour. */
  onAccent: PALETTE.white,
  /** Hover and selection marks on the diagram, in 2D and 3D. */
  highlight: PALETTE.charcoal,
  /** The drawing's grid over the page colour. */
  grid: PALETTE.white,
} as const;

/** Good, warning and alarm: green, amber and red, deep enough to read on the white UI. */
export const STATUS = {
  open: "#16a34a",
  warn: "#d97706",
  alarm: "#dc2626",
} as const;

/**
 * The UI and status colours as CSS variables (panel2 is --panel-2, onAccent --on-accent), which are the only colours
 * the viewer's own Tailwind classes use.
 */
export function uiVariables(): Record<string, string> {
  const vars: Record<string, string> = { ...UI, ...STATUS };
  return Object.fromEntries(
    Object.entries(vars).map(([name, value]) => [`--${name.replace(/[A-Z\d]/g, (c) => `-${c.toLowerCase()}`)}`, value]),
  );
}
