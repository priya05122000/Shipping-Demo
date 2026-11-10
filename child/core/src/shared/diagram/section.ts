import type { ComponentType } from "react";
import type { CatalogKind } from "../catalog";
import type { SectionData } from "../data";
import type { SharedObject } from "../../objects/registry";

/**
 * Props of a section's generated views: the default exports of Diagram2D.tsx and Diagram3D.tsx in its folder, which
 * Ship Docs generates from the line diagram with AI. Both views share the selection.
 */
export interface SectionViewProps {
  /** Tag of the selected piece of equipment, e.g. "P-101", or null. */
  selectedId: string | null;
  /** Called with an item's tag when it's clicked, or null to clear the selection (e.g. a background click). */
  onSelect: (id: string | null) => void;
}

export type SectionView = ComponentType<SectionViewProps>;

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
  /** The generated 2D view (the folder's Diagram2D.tsx), loaded when it's first shown. */
  view2d?: SectionView;
  /** The generated 3D view (the folder's Diagram3D.tsx), loaded when it's first shown. */
  view3d?: SectionView;
  /** Which version of the generated code the views are (1, 2, 3…), from section.json. */
  codeVersion?: number;
}

/** Identity helper so a section's diagram.ts (`export default defineDiagram({...})`) is checked against `Diagram`. */
export function defineDiagram(diagram: Diagram): Diagram {
  return diagram;
}
