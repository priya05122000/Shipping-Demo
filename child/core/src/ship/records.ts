/**
 * Sections and objects are written by the Library (the parent app), one folder each:
 *   src/sections/<folder>/section.json     src/objects/<id>/object.json
 * plus the files they list. These helpers read those folders through Vite's import.meta.glob (see manifest.ts), for
 * ../sections/registry.ts and ../objects/registry.ts.
 */

/** A file entry in a section.json or object.json. Only the fields the viewer uses. */
export interface StoredFileMeta {
  /** Original file name, as uploaded. */
  name: string;
  /**
   * File name in the record's folder, e.g. "lineDiagram-9f2c1a7b.png", or for an object's files, named from the
   * object and tagged with their view, "fuel-pump-2d-77aa01ff.png" (line diagram) and "fuel-pump-3d-3be0d14c.glb" (3D diagram).
   */
  storedName: string;
  /** For an object's files: "2d" (its line diagram) or "3d" (its 3D diagram). Missing from files saved before it existed. */
  view?: "2d" | "3d";
}

/** The folder name in a glob key, e.g. "./engine-room/section.json" -> "engine-room". */
export function folderOf(globKey: string): string {
  return globKey.split("/")[1];
}

/**
 * The URL Vite serves a record's file from, or null if the record has no such file.
 * `urls` is a `?url` glob of the collection's files, keyed like "./engine-room/manual-a1c2e3f4.pdf".
 */
export function fileUrl(urls: Record<string, string>, folder: string, file: StoredFileMeta | undefined): string | null {
  return file?.storedName ? (urls[`./${folder}/${file.storedName}`] ?? null) : null;
}

interface Sortable {
  id: string;
  /** ISO timestamp from the metadata file. */
  createdAt?: unknown;
}

/** Oldest first, matching the Library's order. */
export function byCreation(a: Sortable, b: Sortable): number {
  const at = typeof a.createdAt === "string" ? a.createdAt : "";
  const bt = typeof b.createdAt === "string" ? b.createdAt : "";
  return at.localeCompare(bt) || a.id.localeCompare(b.id);
}
