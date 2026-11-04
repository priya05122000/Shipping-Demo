import { FILE_RULES, type FileRule } from "@/lib/files";

export type CollectionSlug = "sections" | "objects";

export interface FileFieldDef {
  rule: FileRule;
  /** Required fields must be uploaded on create and can't be removed later. Optional ones can be added or removed any time. */
  required: boolean;
}

export interface CollectionDef {
  /** Lower-case noun for messages, e.g. "section". */
  noun: string;
  /** Unique IDs are this prefix plus a sequence number, e.g. "SEC-001". Assigned on create, never reused. */
  idPrefix: string;
  /**
   * Name each record's folder after the name given at creation (e.g. "engine-room"), and keep the ID in its
   * metadata file. Otherwise the folder is named after the ID (e.g. "OBJ-001").
   */
  folderFromName?: boolean;
  /** Folder inside the child app that holds one folder per record. */
  dir: string;
  /** Each record folder's metadata file. */
  metaFile: string;
  fileFields: Record<string, FileFieldDef>;
  /** Fields that hold IDs of records in another collection. */
  links?: Record<string, CollectionSlug>;
}

/**
 * Collection definitions shared by the API routes (validation, storage paths) and the UI (forms, IDs).
 * The slug is used in URLs. Records are saved in the child app, one folder each:
 *   child/<dir>/<folder>/<metaFile>   plus that record's uploaded files
 */
export const COLLECTIONS = {
  sections: {
    noun: "section",
    idPrefix: "SEC",
    folderFromName: true,
    dir: "src/sections",
    metaFile: "section.json",
    fileFields: {
      lineDiagram: { rule: FILE_RULES.image, required: false },
      manual: { rule: FILE_RULES.pdf, required: false },
    },
    links: { objectIds: "objects" },
  },
  objects: {
    noun: "object",
    idPrefix: "OBJ",
    dir: "src/shared/objects",
    metaFile: "object.json",
    fileFields: {
      model: { rule: FILE_RULES.model3d, required: true },
      lineDiagram: { rule: FILE_RULES.image, required: true },
    },
  },
} as const satisfies Record<CollectionSlug, CollectionDef>;

export function isCollectionSlug(value: string): value is CollectionSlug {
  return Object.hasOwn(COLLECTIONS, value);
}

export function collectionDef(slug: CollectionSlug): CollectionDef {
  return COLLECTIONS[slug];
}
