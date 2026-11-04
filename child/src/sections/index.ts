import type { SectionData } from "@/shared/data";
import type { Diagram, Section } from "@/shared/diagram";
import { findObject } from "@/shared/objects";
import { byCreation, fileUrl, folderOf, type StoredFileMeta } from "@/shared/records";

/** Shape of a section.json, as written by the Library. Only the fields the viewer uses. */
interface SectionMeta {
  /** Unique, e.g. "SEC-001". */
  id?: string;
  name?: string;
  createdAt?: string;
  lineDiagram?: StoredFileMeta;
  manual?: StoredFileMeta;
  objectIds?: string[];
}

/*
 * Each section is a folder here, created from the Library (the parent app) and named from the section's name, holding:
 *   section.json   ID, name, files and the IDs of the shared objects it uses (written by the Library)
 *   one line diagram image and one manual (PDF), uploaded in the Library
 *   diagram.ts     optional: hotspots, as `export default defineDiagram({...})` (from @/shared/diagram)
 *   data.json      optional: details per hotspot item ID
 * Folders are found automatically: adding, changing or removing one reloads the viewer.
 */
const metas = import.meta.glob<SectionMeta>("./*/section.json", { eager: true, import: "default" });
const urls = import.meta.glob<string>("./*/*.{png,jpg,jpeg,webp,svg,pdf}", { eager: true, query: "?url", import: "default" });
const diagrams = import.meta.glob<Diagram>("./*/diagram.ts", { eager: true, import: "default" });
const details = import.meta.glob<SectionData>("./*/data.json", { eager: true, import: "default" });

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
  }));

export function findSection(id: string): Section | undefined {
  return sections.find((section) => section.id === id);
}
