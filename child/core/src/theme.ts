import type { ShipTheme } from "./customization";
import { PALETTE, uiVariables } from "./pipeline/components/theme";

/** The viewer's accent colour when a ship doesn't set its own: the charcoal of its UI (pipeline/components/theme.ts). */
export const DEFAULT_ACCENT: string = PALETTE.charcoal;

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
 * Puts the viewer's colours on the page: its UI colours (--page, --panel, --ink, --accent…, which styles.css makes
 * Tailwind colours), and a ship's accent colour in place of the viewer's, or the defaults again when it has none, e.g.
 * after a hot update removes it.
 */
export function applyTheme(theme: ShipTheme | undefined) {
  const style = document.documentElement.style;
  for (const [name, value] of Object.entries(uiVariables())) style.setProperty(name, value);
  if (theme?.accent) {
    style.setProperty("--ship-accent", theme.accent);
    // The UI's accent too: the open section, the selected view, switches that are on, focus rings.
    style.setProperty("--accent", theme.accent);
    for (const [shade, value] of Object.entries(SHADES)) style.setProperty(`--color-accent-${shade}`, value);
  } else {
    style.removeProperty("--ship-accent");
    for (const shade of Object.keys(SHADES)) style.removeProperty(`--color-accent-${shade}`);
  }
}
