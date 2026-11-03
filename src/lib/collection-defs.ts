import { FILE_RULES, type FileRule } from "@/lib/files";

/**
 * Collection definitions shared by the API routes (validation, storage paths)
 * and the UI (forms, IDs). The slug is used in URLs and as the folder/file name on disk.
 */
export const COLLECTIONS = {
  "line-diagrams": {
    idPrefix: "LD",
    fileFields: { image: FILE_RULES.image },
  },
  objects: {
    idPrefix: "OBJ",
    fileFields: { model: FILE_RULES.model3d, lineDiagram: FILE_RULES.image },
  },
  manuals: {
    idPrefix: "MAN",
    fileFields: { pdf: FILE_RULES.pdf },
  },
} as const satisfies Record<string, { idPrefix: string; fileFields: Record<string, FileRule> }>;

export type CollectionSlug = keyof typeof COLLECTIONS;

export function isCollectionSlug(value: string): value is CollectionSlug {
  return Object.hasOwn(COLLECTIONS, value);
}
