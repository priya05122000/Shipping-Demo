import { lazy } from "react";
import type { SectionData } from "@/shared/data";
import type { Diagram, Section, SectionView } from "@/shared/diagram";
import { findObject } from "@/objects";
import { byCreation, fileUrl, folderOf, type StoredFileMeta } from "@/shared/records";

/** Shape of a section.json, as written by the Library. Only the fields the viewer uses. */
interface SectionMeta {
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

/*
 * Each section is a folder here, created from the Library (the parent app) and named from the section's name, holding:
 *   section.json   ID, name, files and the IDs of the ship's objects it uses (written by the Library)
 *   one line diagram image and one manual (PDF), uploaded in the Library
 *   diagram.ts     optional: hotspots, as `export default defineDiagram({...})` (from @/shared/diagram)
 *   data.json      optional: details per hotspot item ID
 *   Diagram2D.tsx, Diagram3D.tsx
 *                  optional: the 2D and 3D views generated from the line diagram by Ship Docs (with AI), each
 *                  default-exporting a component that takes SectionViewProps. Shared parts are in src/shared/schematic.
 * Folders are found automatically: adding, changing or removing one reloads the viewer.
 */
const metas = import.meta.glob<SectionMeta>("./*/section.json", { eager: true, import: "default" });
const urls = import.meta.glob<string>("./*/*.{png,jpg,jpeg,webp,svg,pdf}", { eager: true, query: "?url", import: "default" });
const diagrams = import.meta.glob<Diagram>("./*/diagram.ts", { eager: true, import: "default" });
const details = import.meta.glob<SectionData>("./*/data.json", { eager: true, import: "default" });
// Not eager: each view is its own chunk, loaded when it's first shown, so three.js only loads for a 3D view.
const views2d = import.meta.glob<{ default: SectionView }>("./*/Diagram2D.tsx");
const views3d = import.meta.glob<{ default: SectionView }>("./*/Diagram3D.tsx");

function lazyView(load: (() => Promise<{ default: SectionView }>) | undefined): SectionView | undefined {
  return load ? lazy(load) : undefined;
}

/** Every drawing the viewer can show, in menu order (oldest first, as in the Library). */
export const sections: Section[] = Object.entries(metas)
  .map(([key, meta]) => {
    const folder = folderOf(key);
    return { id: meta.id ?? folder, folder, createdAt: meta.createdAt, meta };
  })
  .sort(byCreation)
  .map(({ id, folder, meta }) => ({
    id,
    title: meta.name ?? folder,
    image: fileUrl(urls, folder, meta.lineDiagram),
    manual: fileUrl(urls, folder, meta.manual),
    diagram: diagrams[`./${folder}/diagram.ts`],
    data: details[`./${folder}/data.json`] ?? { items: {} },
    // An ID whose object was removed (e.g. by hand) is skipped.
    objects: (Array.isArray(meta.objectIds) ? meta.objectIds : []).flatMap((objectId) => findObject(objectId) ?? []),
    view2d: lazyView(views2d[`./${folder}/Diagram2D.tsx`]),
    view3d: lazyView(views3d[`./${folder}/Diagram3D.tsx`]),
    codeVersion: typeof meta.codegenVersion === "number" ? meta.codegenVersion : undefined,
  }));

export function findSection(id: string): Section | undefined {
  return sections.find((section) => section.id === id);
}
