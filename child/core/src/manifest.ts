import type { SectionData } from "./shared/data";
import type { Diagram, SectionView } from "./shared/diagram";
import type { StoredFileMeta } from "./shared/records";

/**
 * One ship's data, as the viewer gets it: its ship.json, and its sections' and objects' files, found with Vite's
 * import.meta.glob. A ship's src/main.tsx imports it from "virtual:ship-manifest", a module the shipViewer() Vite
 * plugin (../vite.ts) writes for that ship, so every ship runs this same viewer on its own data.
 * Glob keys are relative to the collection's folder, e.g. "./engine-room/section.json" or "./OBJ-001/object.json".
 */
export interface ShipManifest {
  /** The ship's ship.json. */
  ship: ShipMeta;
  /** src/sections/<folder>/… */
  sections: SectionFiles;
  /** src/objects/<id>/… */
  objects: ObjectFiles;
}

/** Shape of a ship.json, as written by the Library (the parent app). Only the fields the viewer uses. */
export interface ShipMeta {
  /** Unique, e.g. "SHP-001". The parent checks it when it embeds the viewer. */
  id?: string;
  name?: string;
}

/** Shape of a section.json, as written by the Library. Only the fields the viewer uses. */
export interface SectionMeta {
  /** Unique within the ship, e.g. "SEC-001". */
  id?: string;
  name?: string;
  createdAt?: string;
  lineDiagram?: StoredFileMeta;
  manual?: StoredFileMeta;
  objectIds?: string[];
  /** The version of the generated code in the folder (Diagram2D.tsx, Diagram3D.tsx). */
  codegenVersion?: number;
}

/** Shape of an object.json, as written by the Library. Only the fields the viewer uses. */
export interface ObjectMeta {
  name?: string;
  createdAt?: string;
  model?: StoredFileMeta;
  lineDiagram?: StoredFileMeta;
}

export interface SectionFiles {
  /** ./<folder>/section.json */
  metas: Record<string, SectionMeta>;
  /** URLs of the uploaded images and manuals: ./<folder>/<file> */
  urls: Record<string, string>;
  /** Optional hand-written hotspots: ./<folder>/diagram.ts */
  diagrams: Record<string, Diagram>;
  /** Optional item details: ./<folder>/data.json */
  details: Record<string, SectionData>;
  /** Generated views, loaded when first shown: ./<folder>/Diagram2D.tsx and Diagram3D.tsx */
  views2d: Record<string, () => Promise<{ default: SectionView }>>;
  views3d: Record<string, () => Promise<{ default: SectionView }>>;
}

export interface ObjectFiles {
  /** ./<id>/object.json */
  metas: Record<string, ObjectMeta>;
  /** URLs of the uploaded 3D models and line diagram images: ./<id>/<file> */
  urls: Record<string, string>;
  /** Written by Ship Docs' code generation (see objects/card.ts): ./<id>/card.json */
  cards: Record<string, unknown>;
}
