// The viewer's look, for every part of it: its colours (colors.ts), the class strings its controls share (classes.ts),
// and putting them on the page with a ship's accent colour (apply.ts). It imports nothing else of the viewer's at run
// time (only the ShipTheme type), so anything can import it.
export { PALETTE, STATUS, UI, uiVariables } from "./colors";
export { FOCUS_RING, FOCUS_RING_INSET } from "./classes";
export { applyTheme, DEFAULT_ACCENT } from "./apply";
