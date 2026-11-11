import { PALETTE, STATUS, UI } from '../../theme';
import type { Status } from '../data/readings';
import type { Fluid, PipeDef } from '../model/types';

/*
 * The piping diagrams' own colours: their lines, parts, 3D materials and lights, and the status of each reading. The
 * UI colours are the viewer's (../../theme/colors.ts), so the diagrams match the rest of it; `UI` is re-exported here
 * for the 2D drawing and the 3D scene. A change in either file shows in 2D and 3D alike.
 */

export { UI };

/** Open, warn and alarm are the viewer's status colours; the rest are UI colours. */
export const STATUS_COLOR: Record<Status, string> = {
  open: STATUS.open,
  closed: PALETTE.grayBlue,
  idle: PALETTE.grayBlue,
  ok: PALETTE.darkBlueGray,
  warn: STATUS.warn,
  alarm: STATUS.alarm,
};

/** A line's colours: the layers of the 2D pipe. The 3D liquid is the rim colour. */
interface LineColours {
  rim: string;
  glass: string;
  liquid: string;
  liquidHi: string;
  dark: string;
}

const BLUE_LINE: LineColours = { rim: '#4cc3ff', glass: '#d8f1ff', liquid: '#1499e0', liquidHi: '#8bd8ff', dark: '#075985' };
const RED_LINE: LineColours = { rim: '#ff6b6b', glass: '#ffe0e0', liquid: '#d92626', liquidHi: '#ff9d9d', dark: '#7f1d1d' };
const GREEN_LINE: LineColours = { rim: '#5ad17f', glass: '#dcf7e4', liquid: '#1f9d55', liquidHi: '#8be3a8', dark: '#14532d' };

/** Blue for D.O and for F.O coming from storage, red for F.O and the bunker line, green for recirculation. */
export const FLUID_STYLE: Record<Fluid, LineColours> = {
  DO: BLUE_LINE,
  FO: RED_LINE,
  TR: BLUE_LINE,
  BK: RED_LINE,
  RC: GREEN_LINE,
};

// ── The parts themselves ────────────────────────────────────────────────────

/** Drop shadows and glints in the 2D drawing. */
export const SHADE = { shadow: '#000000', shine: '#ffffff' } as const;

/** Bare steel in the 2D symbols and the info panel icons, from light to dark. */
export const STEEL = {
  light: '#f1f5f9',
  bolt: '#e2e8f0',
  mid: '#94a3b8',
  dim: '#64748b',
  dark: '#475569',
  darker: '#334155',
  outline: '#1e293b',
} as const;

/** The pressure gauge: the 2D symbol, the 3D dial and the info panel icon. */
export const GAUGE = {
  face: '#f8fafc',
  /** The bezel's gradient, light to dark; the icon uses the flat colour. */
  bezel: ['#f8fafc', '#9ca3af', '#374151'],
  bezelFlat: '#cbd5e1',
  /** Ticks, the "PI" label and outlines. */
  ink: STEEL.darker,
  /** The "bar" unit. */
  unit: STEEL.dark,
  /** The normal band and the high band of the scale. */
  normal: '#22c55e',
  high: '#ef4444',
  needle: '#dc2626',
  hub: '#1f2937',
} as const;

/** The 3D models' materials. Paint follows the reference-sheet images: red bodies, blue flanges and handwheels. */
export const MATERIAL = {
  red: '#d8392f',
  blue: '#1a56c9',
  steel: '#c9d1db',
  darkSteel: '#566377',
  galvanized: '#8e99a7',
  blind: '#394457',
  brass: '#d3a84c',
  rubber: '#141a24',
  tankRim: { blue: '#2563eb', red: '#dc2626' },
  tankGlass: { blue: '#d6e8ff', red: '#ffdcdc' },
  /** The chequer-plate box tank, after its photo: light gray paint on the edges, lugs and nozzles, clear plate and its tread. */
  boxTank: { paint: '#d9dee4', glass: '#eef3f8', tread: '#8f9baa' },
  /** Pipe walls: white glass, slightly cool so the warm sun leaves it white. */
  pipeGlass: '#eef5ff',
  /** The gauge glass and the tanks' level marks. */
  clear: '#ffffff',
} as const;

/** The 2D symbols drawn in SVG (pump, non-return valve, filter), in the same paint: light, mid and dark. */
export const PAINT = {
  red: ['#f0786e', MATERIAL.red, '#8c1f18'],
  blue: ['#5b8ef0', MATERIAL.blue, '#0f3480'],
} as const;

/** The 3D lights: sky fill and the sun, and the light gray of the sun's shadows on the floor. The ground fill is UI.page. */
export const LIGHT = { sky: '#c7d8ff', sun: '#fff6ea', shadow: '#dcdcdc' } as const;

// ── Pipes ───────────────────────────────────────────────────────────────────

export function pipeWidth(p: PipeDef): number {
  if (p.size === 'main') return p.fluid === 'FO' ? 15 : 13;
  if (p.size === 'branch') return 11;
  return 7;
}
