/**
 * Plain data types for this ship's generated schematics. No React, no three.js: both the 2D and the 3D views (and any
 * section's schematic.ts) import these.
 *
 * Coordinates are the pixels of the section's line diagram image (x right, y down), so a schematic keeps the drawing's
 * layout. The 3D view maps them onto a vertical plane (see 3d.ts).
 */

export type Point = readonly [number, number];

/** Clockwise, in drawing coordinates. 0 = as the symbol is drawn horizontally (inlet left, outlet right). */
export type Rotation = 0 | 90 | 180 | 270;

/** How sure the link between a drawing component, its Library object and its data record is. */
export type MappingStatus = "verified" | "partially-verified" | "ambiguous" | "missing-data" | "unmatched";

/** Equipment drawn by the shared components (when it has no Library object). */
export type EquipmentKind =
  | "tank"
  | "valve"
  | "angle-valve"
  | "relief-valve"
  | "gauge"
  | "spool"
  | "end-flange"
  | "open-end";

/** Variants of the shared symbols, as they appear on the drawing. */
export type SymbolVariant =
  /** Bowtie with a T handle. */
  | "handwheel"
  /** Bowtie with a filled centre. */
  | "globe"
  /** Bowtie followed by a blind flange (the valve's open end is blanked). */
  | "blind"
  /** Open end with radiating lines (vent / drain / sampling discharge). */
  | "vent"
  /** Open end drawn as a small circle. */
  | "circle";

export interface Fluid {
  id: string;
  label: string;
  /** Line colour, as on the drawing. */
  color: string;
}

export interface Equipment {
  /** Unique instance ID within the section, e.g. "EQ-FB112". */
  id: string;
  /** Tag as printed on the drawing (spaces removed), e.g. "FB112"; null when the drawing gives none. */
  tag: string | null;
  kind: EquipmentKind;
  /** Display name. */
  name: string;
  /** Centre, in drawing pixels. */
  at: Point;
  rotation: Rotation;
  /** Length along the symbol's flow axis, in drawing pixels (visual size only, not an engineering dimension). */
  size: number;
  fluid: string;
  variant?: SymbolVariant;
  /** Library object drawn for it (ObjectSymbol2D / ObjectModel3D), when the mapping is supported. */
  object?: string;
  /** Library objects it might be, awaiting confirmation. Not drawn. */
  candidates?: string[];
  /** Key of its record in the section's data.json, or null if it has none. */
  record: string | null;
  /**
   * ID of the matching entry in the section's manual extract (manual-data.json), for reference only: the views never
   * read that file, which is regenerated when a manual is uploaded.
   */
  manualRecord?: string;
  status: MappingStatus;
  /** Where the tag is printed, if not next to the symbol. */
  label?: { at: Point; rotate?: number };
  /** Engineering remarks shown in the callout, e.g. why a mapping is unconfirmed. */
  note?: string;
}

/** A pipe joint on the drawing: a tee, a bend, or a junction dot. */
export interface Junction {
  id: string;
  at: Point;
  /** The drawing shows a junction dot here. */
  dot?: boolean;
}

/** One end of a pipe: an equipment port, a junction (no port), or a free point (a line that leaves the drawing). */
export type PipeEnd = { item: string; port?: string } | { open: Point };

/** Where a pipe passes another without joining it. */
export interface Crossing {
  at: Point;
  /** "arc": the drawing shows a hop; "gap": the drawing breaks this line. */
  style: "arc" | "gap";
}

export interface Pipe {
  id: string;
  /** Line designation from the drawing, e.g. "FB100-100A". */
  line?: string;
  /** Nominal bore from the drawing's line label, in mm (e.g. 100 for "100A"). Visual pipe thickness only. */
  bore?: number;
  fluid: string;
  from: PipeEnd;
  to: PipeEnd;
  /** Bends between the ends, in order. */
  via?: Point[];
  crossings?: Crossing[];
  /** "verified": traced on the drawing end to end. "unresolved": an end or route isn't established. */
  status: "verified" | "unresolved";
  note?: string;
}

export interface TextLabel {
  text: string;
  at: Point;
  rotate?: number;
  size?: number;
}

export interface Schematic {
  id: string;
  /** Size of the line diagram image the coordinates refer to. */
  width: number;
  height: number;
  fluids: Record<string, Fluid>;
  equipment: Equipment[];
  junctions: Junction[];
  pipes: Pipe[];
  /** Area names and line designations printed on the drawing. */
  labels: TextLabel[];
}

/** The key the views select an item by: its tag, or its instance ID when the drawing gives it no tag. */
export function selectionKey(item: Equipment): string {
  return item.tag ?? item.id;
}
