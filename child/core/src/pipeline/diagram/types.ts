import type { SystemPump, SystemTank } from '../operations/types';

/**
 * What a line carries, which sets its colour. DO and FO are diesel and fuel oil. TR, BK and RC are
 * F.O lines coloured by their service, as on the bunker line drawing: transfer from the storage
 * tanks (blue), bunker fuel to the manifold (red) and recirculation back to storage (green).
 */
export const FLUIDS = ['DO', 'FO', 'TR', 'BK', 'RC'] as const;
export type Fluid = (typeof FLUIDS)[number];

/** Each fluid's short name, for the legend and the overview, and its full name, for the info panel. */
export const FLUID_INFO: Record<Fluid, { name: string; full: string }> = {
  DO: { name: 'D.O', full: 'D.O (diesel oil)' },
  FO: { name: 'F.O', full: 'F.O (fuel oil)' },
  TR: { name: 'F.O transfer', full: 'F.O, transfer from storage' },
  BK: { name: 'Bunker fuel', full: 'F.O, bunker line to the manifold' },
  RC: { name: 'Recirculation', full: 'F.O, recirculation to storage' },
};

export type Pt = [number, number];
export type Side = 'top' | 'bottom' | 'left' | 'right';

/**
 * Part kinds. The number in brackets is the item number on the component
 * reference sheet; those are drawn with a picture from one of the ship's
 * objects (../objects.ts). The rest are not on it and are drawn in SVG.
 */
export type PartKind =
  | 'BFV' // [1] butterfly valve (front view)
  | 'PSV' // [2] safety relief valve
  | 'GLV' // [3] globe valve
  | 'BV' //  [4] ball valve
  | 'HV' //  [5] hydrant / landing valve
  | 'MBV' // [6] butterfly valve (side view), manifold valve
  | 'DJ' //  [7] dismantling joint
  | 'TK' //  [8] blue glass tank / [9] red glass tank, or a see-through chequer-plate box tank
  | 'PI' //  pressure gauge (PI on the drawing)
  | 'MC' //  manifold hose connection (D.O / F.O flange, or bunker connection, on the drawing)
  | 'NRV' // non-return (swing check) valve
  | 'PU' //  centrifugal transfer pump
  | 'FL'; // filter canister, one side of a duplex filter

export type PipeSize = 'main' | 'branch' | 'small';

export interface PipeDef {
  id: string;
  fluid: Fluid;
  line: string;
  size: PipeSize;
  pts: Pt[];
  /** Dashed relief discharge that continues off-sheet. */
  dashed?: boolean;
  /** Draw an arrow at the last point. */
  arrowEnd?: boolean;
  /** At a crossing the pipe with the higher z passes over; the other is broken. */
  z?: number;
}

/**
 * What the drawing shows about a part, beyond where it is: written with the geometry in the section's schematic.
 * Engineering data isn't here: `component` names the part's record in the section's manual-data.json.
 */
export interface PartFacts {
  /** Its name on the drawing, e.g. "D.O Tank No.1 Valve". Default: its tag. */
  name?: string;
  /** What its line carries, for its colour. Default: the first pipe's fluid. */
  fluid?: Fluid;
  /** The line it's on, e.g. "FB100-100A". */
  line?: string;
  /** Where it is on the drawing, e.g. "Accommodation". */
  area?: string;
  /** The Library object (src/objects/<id>) whose 2D picture draws it. Default: the diagram's `objects` for its kind. */
  object?: string;
  /**
   * A valve's engineering tag: the id of its record in the section's manual-data.json, which gives its type,
   * specifications, troubleshooting and starting position, e.g. "FB112".
   */
  component?: string;
  /** The pipes (ids in `pipes`) flow comes in by and leaves by; null at an open end, such as a hose connection. */
  pipes?: { in: string | null; out: string | null };
  /** Ids in the diagram's `systems` that it works with. */
  related?: string[];
  /** A valve's starting position, when its manual-data.json record gives none. Default: closed. */
  open?: boolean;
  relief?: {
    setPressureBar: number;
    /** Tag of the tank it protects. */
    protects?: string;
  };
  tank?: {
    capacityM3: number;
    levelPct: number;
    tempC: number;
    /** Level alarms (%): high, then high-high. */
    highPct: number;
    highHighPct: number;
    /** Tags of the valves on its inlet and, for a tank that supplies the line, its outlet. */
    inletValve?: string;
    outletValve?: string;
  };
  hose?: {
    connected: boolean;
    /** Only needed while connected. */
    pressureBar?: number;
    tempC?: number;
  };
  gauge?: {
    /** Tag of the hose connection whose pressure it shows. */
    hose: string;
    /** Tag of its isolation valve; the gauge reads 0 while that's closed. */
    isolationValve?: string;
    /** Top of the dial, and the pressure above which it warns. */
    maxBar: number;
    highBar: number;
  };
  pump?: {
    running: boolean;
    /** Design capacity. */
    ratedM3h: number;
    suctionBar?: number;
    dischargeBar?: number;
  };
  filter?: {
    inService: boolean;
    dpBar?: number;
    /** The pressure drop at which it needs cleaning, and warns. */
    dpHighBar: number;
  };
}

/** A part on the drawing: where and how it's drawn, and what the drawing shows about it. */
export interface PartLayout extends PartFacts {
  tag: string;
  kind: PartKind;
  at: Pt;
  /** Rotation in degrees (clockwise). -90 puts a valve's handwheel on the left of a vertical pipe. */
  rot?: number;
  /** Mirror horizontally before rotating. */
  flip?: boolean;
  /** Which side of the part its callout sits on. */
  label: Side;
  /** Tanks: an upright glass cylinder (the default), or a box tank of see-through chequer plate. */
  tankShape?: 'cylinder' | 'box';
  /** Cylinder tanks: which glass cylinder image to use. */
  tankColor?: 'blue' | 'red';
  /** Manifold connections: the hose leaves upwards (-1) or downwards (1), before rot turns it. */
  hoseDir?: -1 | 1;
}

/**
 * How a part's picture sits on its pipe, with the pipe running left to right.
 * w/h: drawn size in diagram units.
 * ax/ay: the point of the picture (as fractions) that sits on the pipe's centre line.
 * vis: the opaque part of the picture (fractions: left, top, right, bottom), used for hit areas and callouts.
 */
export interface Placement {
  w: number;
  h: number;
  ax: number;
  ay: number;
  vis: [number, number, number, number];
}

/** A part as the engine uses it: its layout with the defaults filled in, and the object that draws it. */
export interface PartDef extends PartLayout {
  name: string;
  fluid: Fluid;
  area: string;
  line: string;
}

export type Decoration =
  | { type: 'drip'; at: Pt; dir: -1 | 1 }
  | { type: 'cap'; at: Pt; orient: 'h' | 'v' }
  | { type: 'ring'; at: Pt }
  | { type: 'nub'; at: Pt }
  | { type: 'fluidLabel'; at: Pt; text: string }
  /** A dashed box round a group of parts, such as a pump set; at is its top left corner. */
  | { type: 'group'; at: Pt; size: [number, number] };

export interface TextLabel {
  at: Pt;
  text: string;
  rot?: number;
  /** area: large area names. line: line numbers, shown with Tags. note: small captions, always shown. */
  kind: 'area' | 'line' | 'note';
}

/** The systems a diagram's parts belong to (ids are what parts' `related` name). */
export interface PipelineSystems {
  /** A system's tanks, which may be several tanks on the drawing. */
  tanks?: Record<string, SystemTank>;
  /** Its pumps, on the drawing or not (one that isn't stands for the supply at the hose). */
  pumps?: Record<string, SystemPump>;
}

export interface DiagramDef {
  /** Unique within the ship, e.g. "bunker". */
  id: string;
  title: string;
  subtitle: string;
  width: number;
  height: number;
  pipes: PipeDef[];
  parts: PartDef[];
  decorations: Decoration[];
  labels: TextLabel[];
  /** The Library objects (src/objects/<id>) that draw each kind of part, e.g. { BFV: "OBJ-001" }. */
  objects?: Partial<Record<PartKind, string>>;
  systems?: PipelineSystems;
  /** The fluids' names, where the drawing names them otherwise than FLUID_INFO. */
  fluids?: Partial<Record<Fluid, { name: string; full: string }>>;
  /** The title of the flow card in the overview, e.g. "Bunkering flow". Default: "Flow". */
  flowTitle?: string;
}

/** A section's schematic, as its geometry file default-exports it (`definePipeline({...})`): the drawing and its parts. */
export type DiagramLayout = Omit<DiagramDef, 'parts'> & { parts: PartLayout[] };

/** A fluid's names on this diagram. */
export function fluidInfo(def: Pick<DiagramDef, 'fluids'>, fluid: Fluid): { name: string; full: string } {
  return def.fluids?.[fluid] ?? FLUID_INFO[fluid];
}
