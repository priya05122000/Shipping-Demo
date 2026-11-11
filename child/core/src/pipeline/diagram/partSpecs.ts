import type { PartDef, PartKind, PartLayout, Placement } from './types';

/**
 * Where each kind's picture (its Library object's 2D file, drawn by ObjectSymbol2D) sits on its pipe: see Placement.
 * Made for reference-sheet style pictures: a front-view butterfly valve, a safety relief valve, a globe valve, a ball
 * valve, a hydrant valve, a side-view (manifold) butterfly valve, a dismantling joint and an upright glass cylinder
 * tank. The other kinds are drawn in SVG.
 */
const PLACEMENT: Partial<Record<PartKind, Placement>> = {
  BFV: { w: 33, h: 50, ax: 0.5, ay: 0.655, vis: [0.18, 0.01, 0.82, 0.95] },
  PSV: { w: 33, h: 46, ax: 0.49, ay: 0.72, vis: [0.16, 0.01, 0.95, 0.98] },
  GLV: { w: 40, h: 37.4, ax: 0.5, ay: 0.745, vis: [0.16, 0.01, 0.84, 0.98] },
  BV: { w: 52, h: 26, ax: 0.3, ay: 0.715, vis: [0.02, 0.03, 0.99, 0.97] },
  HV: { w: 46, h: 34.5, ax: 0.18, ay: 0.71, vis: [0.18, 0.0, 0.9, 0.99] },
  MBV: { w: 22, h: 58, ax: 0.5, ay: 0.65, vis: [0.02, 0.0, 0.98, 0.94] },
  DJ: { w: 58, h: 28.7, ax: 0.5, ay: 0.5, vis: [0.02, 0.07, 0.98, 0.93] },
  TK: { w: 58, h: 80.3, ax: 0.5, ay: 0.5, vis: [0.12, 0.03, 0.9, 0.98] },
};

/** Liquid area inside a glass cylinder tank's picture, as fractions of it. */
export const TANK_INTERIOR = { x0: 0.22, x1: 0.78, top: 0.18, bottom: 0.79 };

export const isBoxTank = (part: PartLayout) => part.kind === 'TK' && part.tankShape === 'box';

/**
 * The box tank in 2D, around the tank's position: the front face from x0 to x1
 * and top to bottom, and the top and right side going back by `back`.
 */
export const BOX_TANK_2D = { x0: -28, x1: 16, top: -20, bottom: 30, back: [14, -10] as const };

export const GAUGE_RADIUS = 14;

/** Where the part's picture sits; undefined for the kinds drawn in SVG (they need no object). */
export function placementOf(part: PartLayout): Placement | undefined {
  return isBoxTank(part) ? undefined : PLACEMENT[part.kind];
}

export const KIND_INFO: Record<PartKind, { label: string; ref: string }> = {
  BFV: { label: 'Butterfly valve', ref: '1' },
  PSV: { label: 'Safety relief valve', ref: '2' },
  GLV: { label: 'Globe valve', ref: '3' },
  BV: { label: 'Ball valve', ref: '4' },
  HV: { label: 'Hydrant / landing valve', ref: '5' },
  MBV: { label: 'Butterfly valve (manifold)', ref: '6' },
  DJ: { label: 'Dismantling joint', ref: '7' },
  TK: { label: 'Glass tank', ref: '8' },
  PI: { label: 'Pressure gauge', ref: 'PI' },
  MC: { label: 'Manifold hose connection', ref: 'MC' },
  NRV: { label: 'Non-return valve', ref: 'NRV' },
  PU: { label: 'Centrifugal pump', ref: 'P' },
  FL: { label: 'Duplex filter', ref: 'F' },
};

export function refNumber(part: PartDef): string {
  if (isBoxTank(part)) return 'TK';
  if (part.kind === 'TK') return part.tankColor === 'red' ? '9' : '8';
  return KIND_INFO[part.kind].ref;
}

/** What the part is, for the tooltip and the info panel. */
export const kindLabel = (part: PartDef) => (isBoxTank(part) ? 'Chequer-plate tank' : KIND_INFO[part.kind].label);

/** Whether the part is an item on the component reference sheet (it has a number there). */
export const onReferenceSheet = (part: PartDef) => /^\d+$/.test(refNumber(part));

export const VALVE_KINDS: ReadonlySet<PartKind> = new Set(['BFV', 'PSV', 'GLV', 'BV', 'HV', 'MBV', 'NRV']);

/** Parts the reference sheet has no image of, drawn as SVG symbols instead (Parts.tsx). */
export const SYMBOL_KINDS: ReadonlySet<PartKind> = new Set(['NRV', 'PU', 'FL']);

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Extent of the parts drawn in SVG, with the pipe running left to right through (0, 0). */
export const SYMBOL_BOX: Partial<Record<PartKind, Box>> = {
  NRV: { x0: -17, y0: -14.5, x1: 17, y1: 10 },
  PU: { x0: -29, y0: -16.5, x1: 29, y1: 25 },
  FL: { x0: -26, y0: -43, x1: 26, y1: 55 },
  MC: { x0: -14, y0: -5, x1: 14, y1: 5 },
};

/** Extent of a part drawn in SVG (a symbol or a box tank), or undefined for one drawn from an image. */
export function symbolBox(part: PartDef): Box | undefined {
  if (!isBoxTank(part)) return SYMBOL_BOX[part.kind];
  const { x0, x1, top, bottom, back } = BOX_TANK_2D;
  return { x0, y0: top + back[1], x1: x1 + back[0], y1: bottom };
}

/** A part's extent before rotation, around the point where it sits on the pipe. */
function localBox(part: PartDef): Box {
  const symbol = symbolBox(part);
  if (symbol) return symbol;
  const img = placementOf(part)!;
  const [vx0, vy0, vx1, vy1] = img.vis;
  return { x0: (vx0 - img.ax) * img.w, y0: (vy0 - img.ay) * img.h, x1: (vx1 - img.ax) * img.w, y1: (vy1 - img.ay) * img.h };
}

/** Bounding box of a part in diagram coordinates (opaque area, after rotation). */
export function partBox(part: PartDef): Box {
  const [x, y] = part.at;
  if (part.kind === 'PI') {
    const r = GAUGE_RADIUS + 1;
    return { x0: x - r, y0: y - r, x1: x + r, y1: y + r };
  }
  const b = localBox(part);
  const local: [number, number][] = [
    [b.x0, b.y0],
    [b.x1, b.y0],
    [b.x1, b.y1],
    [b.x0, b.y1],
  ];
  const a = ((part.rot ?? 0) * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const pts = local.map(([lx, ly]) => {
    const fx = part.flip ? -lx : lx;
    return [x + fx * cos - ly * sin, y + fx * sin + ly * cos];
  });
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}
