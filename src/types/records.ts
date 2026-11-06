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
  /** URL the parent serves the file from, by folder, e.g. "/api/files/mv-aurora/sections/engine-room/lineDiagram-9f2c1a7b.png". */
  url: string;
  /** ISO timestamp. */
  uploadedAt: string;
}

export interface BaseRecord {
  /** Read-only, assigned on create and never reused, e.g. "SHP-001", or "SEC-001" (unique within its ship). */
  id: string;
  /**
   * The record's folder in the child app: a ship's or section's is made from its name when it's created (e.g. "engine-room")
   * and never changes; an object's is its ID. Derived from where the record is, so it isn't saved in the metadata file.
   */
  folder: string;
  name: string;
  /** ISO timestamp. */
  createdAt: string;
  /** ISO timestamp. */
  updatedAt: string;
}

/** What was read from a section's manual into its manual-data.json when the manual was uploaded. */
export interface ManualData {
  /** Components found in the manual's tables; 0 if none could be read. */
  components: number;
  /** ISO timestamp. */
  extractedAt: string;
  /** Why nothing was read, e.g. the PDF has no component tables. Set only when there's no manual-data.json. */
  error?: string;
}

/** A project: one ship, a standalone viewer project holding its own sections and objects. Saved in child/ships/<folder>/ship.json. */
export interface Project extends BaseRecord {
  /** Seven digits, e.g. "9074729". */
  imoNumber?: string;
  /** E.g. "Bulk carrier". */
  vesselType?: string;
  description?: string;
  /** Counted from the ship's folder each time projects are listed; not saved. */
  sectionCount: number;
  objectCount: number;
}

/** A drawing: at most one line diagram and one manual, plus the ship's objects it uses. Saved in child/ships/<ship>/src/sections/<folder>/. */
export interface Section extends BaseRecord {
  lineDiagram?: StoredFile;
  manual?: StoredFile;
  /** Set when a manual is uploaded, and cleared when it's removed. */
  manualData?: ManualData;
  /** IDs of the ship's objects, e.g. ["OBJ-001"], in the order they were picked. */
  objectIds: string[];
}

/** A 3D model with its line diagram, shared by every section of its ship. Saved in child/ships/<ship>/src/objects/<id>/. */
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
