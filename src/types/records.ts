import type { DiagramView } from "@/lib/files";

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
  /**
   * File name on disk, inside the record's folder. Unique per upload. "<field>-<unique>.<ext>" for a section's files,
   * e.g. "lineDiagram-9f2c1a7b.png"; for an object's, made from its name and tagged with the view, e.g.
   * "fuel-pump-2d-77aa01ff.png" and "fuel-pump-3d-3be0d14c.glb" (objects saved before that have "lineDiagram-…" and "model-…").
   */
  storedName: string;
  /** URL the parent serves the file from, by folder, e.g. "/api/files/mv-aurora/sections/engine-room/lineDiagram-9f2c1a7b.png". */
  url: string;
  /** ISO timestamp. */
  uploadedAt: string;
  /** For an object's files: the view it's shown in, "2d" (its line diagram) or "3d" (its 3D diagram). From the field. */
  view?: DiagramView;
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

export type CodegenStatus = "queued" | "running" | "done" | "failed" | "cancelled";

/**
 * Which prompt a generation used: "first" for the ship's first generation (it creates the ship's shared schematic
 * components), "second" for every later one (it reuses and extends them). See src/server/codegen/prompts/.
 */
export type CodegenMode = "first" | "second";

/**
 * The AI-generated 2D and 3D React code for a section's line diagram (see src/server/codegen/). Set when a line
 * diagram is uploaded or "Generate again" is used, and updated as the generation runs.
 */
export interface SectionCodegen {
  /** Identifies one generation. A new upload or "Generate again" starts a new one. */
  runId: string;
  status: CodegenStatus;
  /** Stored name of the line diagram the code is made from, e.g. "lineDiagram-9f2c1a7b.png". */
  lineDiagram: string;
  /** Set when the generation starts. */
  mode?: CodegenMode;
  /** ISO timestamps. */
  requestedAt: string;
  startedAt?: string;
  finishedAt?: string;
  /** Files the generation created or changed, relative to the ship's folder. Set when it's done. */
  files?: string[];
  /** The agent's closing summary. Set when it's done. */
  summary?: string;
  /** Why it failed or was stopped. */
  error?: string;
  /**
   * ISO time the Claude plan's usage limit resets, while the generation waits for it (status "queued"): it then
   * starts again on its own. See src/server/codegen/plan.ts.
   */
  waitingUntil?: string;
  /** The version the generation created. Set when it's done. */
  version?: number;
  /**
   * What happened to the generation's change to the template, from generations made when they could change it (now
   * they can't: ships share child/core, which only people change). Kept so those records still show it.
   */
  sharedChange?: SharedChange;
  /** Tokens and turns, as the Claude Agent SDK reported them. Set when the generation ends, however it ends. */
  usage?: CodegenUsage;
  /** The configured limit that stopped it, if one did (it's then failed, and nothing it wrote was kept). */
  limit?: CodegenLimit;
  /** How the section's objects were used. Set when it's done. */
  objects?: CodegenObjects;
  /** What the agent is doing right now, while running. Never saved: added when sections are listed. */
  progress?: string;
}

/**
 * How a generation used the section's objects (IDs, e.g. "OBJ-001"). The agent looks at an object's image only the
 * first time a generation uses it, and writes the object's card; later generations get the card as text instead (see
 * src/server/codegen/objects.ts).
 */
export interface CodegenObjects {
  /** New to the ship's code: their images were sent, and their cards written. */
  learned: string[];
  /** Placed from their cards, without their images. */
  reused: string[];
  /** Not looked at in this generation (too many new ones, too big, or no usable card): placed from their names. */
  skipped: string[];
}

/** The limits on a generation (see src/server/codegen/agent.ts): CODEGEN_MAX_TURNS, CODEGEN_FIX_ROUNDS. */
export type CodegenLimit = "turns" | "fixRounds";

/** A generation's use of Claude (through Claude Code, on its signed-in plan), as the Claude Agent SDK reported it. */
export interface CodegenUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
  /** Turns the agent took; unset when the generation was stopped before the SDK reported them. */
  turns?: number;
}

/** One of the Claude plan's usage limits, e.g. the 5-hour session or the week. */
export interface PlanUsageWindow {
  /** E.g. "Current session (5 hours)". */
  label: string;
  /** Percentage used, 0-100, or null when Claude Code didn't say. */
  utilization: number | null;
  /** ISO time it resets. */
  resetsAt: string | null;
  /** Set for a limit that only counts one model's use, e.g. "Opus": it only holds back generations with that model. */
  model?: string;
}

/** The usage of the Claude plan Claude Code is signed in with on this machine (GET /api/claude/usage). */
export interface PlanUsage {
  /** False when the plan's limits couldn't be read (not signed in, or Claude Code didn't report them); see `error`. */
  available: boolean;
  /** E.g. "pro", "max". */
  subscription: string | null;
  windows: PlanUsageWindow[];
  /** ISO time generations are waiting until, while a limit is reached. */
  waitingUntil?: string;
  /** ISO time it was read. */
  checkedAt: string;
  error?: string;
}

/**
 * A generation's change to the template (child/template/), when ships were copies of it and generations could change
 * it: kept if the template still type-checked with it and it broke no existing ship that had the changed files,
 * otherwise rejected (rolled back, while the section's own code was kept). Only older records have one.
 */
export interface SharedChange {
  status: "kept" | "rejected";
  /** The template's files it changed, relative to the template's folder, e.g. "src/shared/ui/Badge.tsx". */
  files: string[];
  /** The names of the existing ships it was checked against: those that have the changed files. */
  checkedShips: string[];
  /** Why it was rejected. */
  reason?: string;
}

/**
 * A finished generation of a section's code: numbered 1, 2, 3… per section, and written in a folder of its own,
 * child/ships/<ship>/src/sections/<folder>/v<version>/, so the section can be switched to any version.
 */
export interface CodegenVersion {
  version: number;
  /** ISO timestamp. */
  finishedAt: string;
  mode: CodegenMode;
  /** Original file name of the line diagram it was generated from, e.g. "fuel-oil-rev2.png". */
  lineDiagramName: string;
  /** The version's code files, relative to its folder, e.g. "Diagram2D.tsx". */
  files: string[];
}

/** A drawing: at most one line diagram and one manual, plus the ship's objects it uses. Saved in child/ships/<ship>/src/sections/<folder>/. */
export interface Section extends BaseRecord {
  lineDiagram?: StoredFile;
  manual?: StoredFile;
  /** Set when a manual is uploaded, and cleared when it's removed. */
  manualData?: ManualData;
  /** IDs of the ship's objects, e.g. ["OBJ-001"], in the order they were picked. */
  objectIds: string[];
  /** The latest generation of React code for the line diagram, if any has been requested. */
  codegen?: SectionCodegen;
  /** The section's code versions, oldest first. */
  codegenVersions?: CodegenVersion[];
  /** The version the viewer shows (its v<N>/ folder): the latest, or one switched back to. */
  codegenVersion?: number;
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
