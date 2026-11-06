import type { CatalogKind } from "@/shared/catalog";
import type { SectionData } from "@/shared/data";
import type { SharedObject } from "@/objects";

/** A clickable piece of equipment on a line diagram. */
export interface DiagramItem {
  /** Tag as printed on the drawing, e.g. "P-101". Also the key into the section's data.json. */
  id: string;
  label: string;
  kind: CatalogKind;
  /** Hotspot rectangle, in pixels of the section's line diagram image. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Diagram {
  /** Pixel size of the line diagram image; hotspot coordinates use the same space. */
  width: number;
  height: number;
  items: DiagramItem[];
}

/** One drawing: a folder in src/sections, created from the Library and named from the section's name. */
export interface Section {
  /** ID from the Library, unique within its ship, e.g. "SEC-001". Used by the parent's ?section= link. */
  id: string;
  title: string;
  /** URL of the line diagram image, or null until one is added in the Library. */
  image: string | null;
  /** URL of the manual (PDF), or null until one is added in the Library. */
  manual: string | null;
  /** Hotspots, from the folder's optional diagram.ts. Without one, the line diagram is shown on its own. */
  diagram?: Diagram;
  /** Item details, from the folder's optional data.json. */
  data: SectionData;
  /** The ship's objects picked for this section in the Library, in the order they were picked. */
  objects: SharedObject[];
}

/** Identity helper so a section's diagram.ts (`export default defineDiagram({...})`) is checked against `Diagram`. */
export function defineDiagram(diagram: Diagram): Diagram {
  return diagram;
}
