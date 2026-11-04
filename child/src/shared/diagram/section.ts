import type { ComponentType, SVGProps } from "react";
import type { CatalogKind } from "@/shared/catalog";
import type { SectionData } from "@/shared/data";

/** A clickable piece of equipment on a line diagram. */
export interface DiagramItem {
  /** Tag as printed on the drawing, e.g. "P-101". Also the key into the section's data.json. */
  id: string;
  label: string;
  kind: CatalogKind;
  /** Hotspot rectangle, in pixels of the section's line-diagram.png. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Diagram {
  /** Pixel size of line-diagram.png; hotspot coordinates use the same space. */
  width: number;
  height: number;
  items: DiagramItem[];
}

/** One drawing, defined by a folder in src/sections. */
export interface Section {
  /** URL-safe ID (lowercase, hyphen-separated). Used by the parent's ?section= link. */
  id: string;
  title: string;
  description: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** URL of line-diagram.png. */
  image: string;
  diagram: Diagram;
  data: SectionData;
}

/** Identity helper so each section's index.ts is checked against `Section`. */
export function defineSection(section: Section): Section {
  return section;
}
