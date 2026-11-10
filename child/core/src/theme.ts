import type { ShipTheme } from "./customization";

/** The viewer's accent colour when a ship doesn't set its own (Tailwind's indigo-600). */
export const DEFAULT_ACCENT = "#4f46e5";

/**
 * The accent palette (styles.css: --color-accent-*), made from one colour: each shade mixed with white or black, as
 * Tailwind's palettes roughly are. 600 is the colour itself.
 */
const SHADES: Record<string, string> = {
  50: "color-mix(in oklab, var(--ship-accent) 8%, white)",
  100: "color-mix(in oklab, var(--ship-accent) 16%, white)",
  200: "color-mix(in oklab, var(--ship-accent) 32%, white)",
  500: "color-mix(in oklab, var(--ship-accent) 85%, white)",
  600: "var(--ship-accent)",
  700: "color-mix(in oklab, var(--ship-accent) 85%, black)",
  800: "color-mix(in oklab, var(--ship-accent) 70%, black)",
};

/**
 * Applies a ship's theme to the page: its accent colour replaces the viewer's (styles.css' defaults), or the defaults
 * come back when it has none, e.g. after a hot update removes it.
 */
export function applyTheme(theme: ShipTheme | undefined) {
  const style = document.documentElement.style;
  if (theme?.accent) {
    style.setProperty("--ship-accent", theme.accent);
    for (const [shade, value] of Object.entries(SHADES)) style.setProperty(`--color-accent-${shade}`, value);
  } else {
    style.removeProperty("--ship-accent");
    for (const shade of Object.keys(SHADES)) style.removeProperty(`--color-accent-${shade}`);
  }
}
