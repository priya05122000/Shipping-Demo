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
  /** File name on disk, e.g. "LD-001-image-k3x9q2.png". Unique per upload. */
  storedName: string;
  /** URL the file is served from, e.g. "/api/files/line-diagrams/LD-001-image-k3x9q2.png". */
  url: string;
  /** ISO timestamp. */
  uploadedAt: string;
}

export interface BaseRecord {
  /** Read-only, auto-generated per tab, e.g. "LD-001". */
  id: string;
  name: string;
  /** ISO timestamp. */
  createdAt: string;
  /** ISO timestamp. */
  updatedAt: string;
}

export interface LineDiagram extends BaseRecord {
  image: StoredFile;
}

export interface ObjectRecord extends BaseRecord {
  model: StoredFile;
  lineDiagram: StoredFile;
}

export interface Manual extends BaseRecord {
  pdf: StoredFile;
}

/** Shape of each collection's JSON file in the data folder. */
export interface CollectionData<T extends BaseRecord> {
  version: 1;
  /** Next ID sequence number. Only ever increases, so deleted IDs are never reused. */
  nextSeq: number;
  items: T[];
}

/** What the API returns for a collection. */
export interface CollectionSnapshot<T extends BaseRecord> {
  items: T[];
  nextSeq: number;
  /** Total bytes of all files stored for this collection. */
  totalBytes: number;
}

/** Keys of T whose value is a StoredFile. */
export type FileKey<T> = {
  [K in keyof T]-?: T[K] extends StoredFile ? K : never;
}[keyof T] &
  string;
