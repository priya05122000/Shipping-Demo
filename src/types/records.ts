/** Metadata for an uploaded file; the bytes live in the local data folder. */
export interface StoredFile {
  /** Original file name as uploaded. */
  name: string;
  /** Size in bytes. */
  size: number;
  /** MIME type reported by the browser (falls back to application/octet-stream). */
  type: string;
  /** Lower-case extension without the dot, e.g. "png". */
  extension: string;
  /** File name on disk, inside the record's folder, e.g. "lineDiagram-9f2c1a7b.png". Unique per upload. */
  storedName: string;
  /** URL the parent serves the file from, e.g. "/api/files/sections/engine-room/lineDiagram-9f2c1a7b.png" (by folder). */
  url: string;
  /** ISO timestamp. */
  uploadedAt: string;
}

export interface BaseRecord {
  /** Read-only and unique, assigned on create and never reused, e.g. "SEC-001" or "OBJ-001". */
  id: string;
  /**
   * The record's folder in the child app: a section's is made from its name when it's created (e.g. "engine-room")
   * and never changes; an object's is its ID. Derived from where the record is, so it isn't saved in the metadata file.
   */
  folder: string;
  name: string;
  /** ISO timestamp. */
  createdAt: string;
  /** ISO timestamp. */
  updatedAt: string;
}

/** A drawing: at most one line diagram and one manual, plus the shared objects it uses. Saved in child/src/sections/<folder>/. */
export interface Section extends BaseRecord {
  lineDiagram?: StoredFile;
  manual?: StoredFile;
  /** IDs of objects, e.g. ["OBJ-001"], in the order they were picked. */
  objectIds: string[];
}

/** A 3D model with its line diagram, shared by every section. Saved in child/src/shared/objects/<id>/. */
export interface ObjectRecord extends BaseRecord {
  model: StoredFile;
  lineDiagram: StoredFile;
}

/** What the API returns for a collection. */
export interface CollectionSnapshot<T extends BaseRecord> {
  /** Oldest first. */
  items: T[];
  /** Next ID sequence number. */
  nextSeq: number;
  /** Total bytes of all files stored for this collection. */
  totalBytes: number;
}

/** Keys of T whose value is a StoredFile (optional ones included). */
export type FileKey<T> = {
  [K in keyof T]-?: NonNullable<T[K]> extends StoredFile ? K : never;
}[keyof T] &
  string;
