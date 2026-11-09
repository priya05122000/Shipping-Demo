import { FILE_RULES, type FileRule } from "@/lib/files";
import { normalizeImo, validateImo } from "@/lib/imo";

export type CollectionSlug = "projects" | "sections" | "objects";

/** The collections that live inside a project (ship). */
export type ProjectCollectionSlug = Exclude<CollectionSlug, "projects">;

export interface FileFieldDef {
  rule: FileRule;
  /** Required fields must be uploaded on create and can't be removed later. Optional ones can be added or removed any time. */
  required: boolean;
}

/** An optional line or paragraph of text, e.g. a ship's IMO number. Left empty, it isn't saved. */
export interface TextFieldDef {
  /** Label for messages, e.g. "IMO number". */
  label: string;
  max: number;
  /** Applied to the trimmed value before it's checked and saved, e.g. "IMO 9074729" -> "9074729". */
  normalize?: (value: string) => string;
  /** Null if the (normalized) value is fine, otherwise why not. */
  validate?: (value: string) => string | null;
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
  /**
   * Set when each record belongs to a record of that collection: then `dir` is inside the parent record's folder,
   * and IDs are counted per parent (every ship has its own SEC-001).
   */
  parent?: "projects";
  /** Folder that holds one folder per record: inside the parent record's folder if there's a parent, else inside child/. */
  dir: string;
  /** Each record folder's metadata file. */
  metaFile: string;
  fileFields: Record<string, FileFieldDef>;
  textFields?: Record<string, TextFieldDef>;
  /** Fields that hold IDs of records in another collection (of the same parent). */
  links?: Record<string, CollectionSlug>;
}

/**
 * Collection definitions shared by the API routes (validation, storage paths) and the UI (forms, IDs).
 * The slug is used in URLs. Records are saved in the child folder, one folder each:
 *   child/ships/<ship>/ship.json                       a project (ship): a standalone viewer project, made from child/template
 *   child/ships/<ship>/<dir>/<folder>/<metaFile>       its sections and objects, plus their uploaded files
 */
export const COLLECTIONS = {
  projects: {
    noun: "ship",
    idPrefix: "SHP",
    folderFromName: true,
    dir: "ships",
    metaFile: "ship.json",
    fileFields: {},
    textFields: {
      imoNumber: { label: "IMO number", max: 7, normalize: normalizeImo, validate: validateImo },
      vesselType: { label: "Vessel type", max: 60 },
      description: { label: "Description", max: 1000 },
    },
  },
  sections: {
    noun: "section",
    idPrefix: "SEC",
    folderFromName: true,
    parent: "projects",
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
    parent: "projects",
    dir: "src/objects",
    metaFile: "object.json",
    fileFields: {
      model: { rule: FILE_RULES.model3d, required: true },
      lineDiagram: { rule: FILE_RULES.image, required: true },
    },
  },
} as const satisfies Record<CollectionSlug, CollectionDef>;

/** Written in a section's folder whenever its manual is uploaded: the component tables read from it (see src/server/manual-data.ts). */
export const MANUAL_DATA_FILE = "manual-data.json";

/** In each folder of record folders: its ID counter, so IDs are never reused (see src/server/storage.ts). */
export const COUNTER_FILE = "next-id.json";

export function isProjectCollection(value: string): value is ProjectCollectionSlug {
  return value !== "projects" && Object.hasOwn(COLLECTIONS, value);
}

export function collectionDef(slug: CollectionSlug): CollectionDef {
  return COLLECTIONS[slug];
}

/** A ship's project folder, relative to child/, e.g. "ships/mv-aurora". */
export function projectDir(projectFolder: string): string {
  return `${COLLECTIONS.projects.dir}/${projectFolder}`;
}

/** Where a collection's record folders are, relative to child/, e.g. "ships/mv-aurora/src/sections". */
export function collectionDir(slug: CollectionSlug, projectFolder?: string): string {
  const def = collectionDef(slug);
  if (!def.parent) return def.dir;
  if (!projectFolder) throw new Error(`${slug} belong to a project`);
  return `${projectDir(projectFolder)}/${def.dir}`;
}

/** Checks one text field's value: null if it's fine (empty is fine), otherwise why not. Shared by the form and the API. */
export function checkTextField(field: TextFieldDef, raw: string): { value: string; error: string | null } {
  const trimmed = raw.trim();
  const value = trimmed && field.normalize ? field.normalize(trimmed) : trimmed;
  if (!value) return { value, error: null };
  if (value.length > field.max) return { value, error: `${field.label} must be ${field.max} characters or fewer.` };
  return { value, error: field.validate?.(value) ?? null };
}
