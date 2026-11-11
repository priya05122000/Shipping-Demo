import fs from "node:fs/promises";
import path from "node:path";
import { CODEGEN_DIR, OBJECT_CARD_FILE } from "@/lib/codegen";
import { COLLECTIONS, COUNTER_FILE, MANUAL_DATA_FILE } from "@/lib/collection-defs";
import { VIEW_FILE_NAME } from "@/lib/files";
import { CHILD_DIR, CORE_DIR, errorCode, SHIP_TEMPLATE_DIR, writeAtomic } from "@/server/child-dir";

/**
 * What the code generation agent may touch. agent.ts checks every tool call against it before the call runs, and
 * again after (see verify and scanForLinks), so a path changed in between (TOCTOU) is caught; the server's own file
 * operations for a generation use the same checks.
 *   - Only child/: nothing outside it, such as the Ship Docs app (the parent), can be read or written.
 *   - The agent works on a copy, the stage (staging.ts): it may write only in the stage's copy of its ship. The real
 *     ship changes only when the job applies the finished, checked changes. The viewer every ship runs (child/core,
 *     @shipdocs/viewer-core) and the template are read-only: a generation for one ship can never change another, and
 *     shared UI is changed by people, in child/core, where it reaches every ship.
 *   - It may read anything in child/ except earlier versions of generated code (each ship's codegen/), other stages,
 *     and the ships' objects' uploaded files (images and 3D models): an object's card describes it instead, and the
 *     viewer draws its files. The only exceptions are the images a generation allows (see allowObjects).
 *   - Paths are taken as they are: one with "..", one that passes through a symlink or junction (even inside
 *     child/), and a hard-linked file (which may share its content with a file outside child/) are all refused.
 *   - Some files can't be written at all (see protectedReason). In an object's folder, only its card can be written,
 *     and during a generation only for the objects whose images it looks at.
 */

/** In a section's folder, TypeScript files that aren't generated code: written by hand (see the README). */
const HAND_WRITTEN = new Set(["diagram.ts"]);
const CODE_EXTENSION = /\.(ts|tsx)$/;

/**
 * Whether a file in a section's folder (relative to it, with forward slashes) is generated code: what a version of the
 * section keeps, and what restoring one replaces.
 */
export function isGeneratedSectionFile(relPath: string): boolean {
  return CODE_EXTENSION.test(relPath) && !HAND_WRITTEN.has(relPath);
}

/** The section's generated files, relative to its folder, with forward slashes, sorted. Links are never followed. */
export async function listGeneratedFiles(sectionDir: string): Promise<string[]> {
  const files: string[] = [];
  async function walk(dir: string) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      // Symlinks and junctions are neither, so they're never followed.
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile()) {
        const rel = path.relative(sectionDir, full).split(path.sep).join("/");
        if (isGeneratedSectionFile(rel)) files.push(rel);
      }
    }
  }
  await walk(sectionDir);
  return files.sort();
}

/** One name in a path the agent writes: plain names only, so Windows tricks ("a:stream", "name.", "PACKAG~1.JSO") can't sneak in. */
const SAFE_NAME = /^[A-Za-z0-9_-][A-Za-z0-9._-]*$/;

/** Files the Library writes in a ship, wherever they are: records' metadata (ship.json, section.json, object.json), ID counters and manual data. */
const LIBRARY_FILES = new Set<string>(
  [...Object.values(COLLECTIONS).map((def) => def.metaFile), COUNTER_FILE, MANUAL_DATA_FILE].map((name) => name.toLowerCase()),
);
/** Files uploaded in the Library, by the names storage.ts stores them under, e.g. "lineDiagram-9f2c1a7b.png". */
const FIELD_UPLOAD = new RegExp(
  `^(${[...new Set(Object.values(COLLECTIONS).flatMap((def) => Object.keys(def.fileFields)))].join("|")})-[0-9a-f]{8}\\.[a-z0-9]+$`,
  "i",
);
/**
 * Whether a file name is one the Library stores uploads under: named after the field, or, for an object's files, from
 * its name and tagged with the view (VIEW_FILE_NAME, e.g. "fuel-pump-3d-3be0d14c.glb"). Without case, as Windows does.
 */
function isUploadedFile(name: string): boolean {
  return FIELD_UPLOAD.test(name) || VIEW_FILE_NAME.test(name.toLowerCase());
}
/**
 * Files at the top of a project that decide how it's built and checked: a change could run code on this machine at
 * the next build (package.json scripts, vite.config.ts), or switch off the type check that catches the agent's errors
 * (tsconfig*.json).
 */
const BUILD_FILE = /^(package(-lock)?\.json|vite\.config\.[cm]?[jt]s|tsconfig(\.[A-Za-z0-9_-]+)?\.json)$/i;
/**
 * A ship's entry files, the same in every ship (from the template): they start the shared viewer with the ship's data,
 * and give its code the viewer's types and styles.
 */
const ENTRY_FILES = new Set(["src/main.tsx", "src/env.d.ts", "src/styles.css"]);
/**
 * A ship's customizations (child/core/src/customize/types.ts: layer 2, the UI and functionality for that ship only),
 * made by people. The agent reads them, but its code (layer 3) never changes them.
 */
const CUSTOM_DIR = "src/custom";
/** A project's objects folder, as names from the project's folder down, in lower case: ["src", "objects"]. */
const OBJECTS_DIR = COLLECTIONS.objects.dir.toLowerCase().split("/");

/**
 * For a path in a project's objects folder (names from the project's folder down, in lower case): the names below
 * that folder, e.g. ["obj-001", "card.json"] or ["objects.ts"]. Null for a path outside it.
 */
function objectsPart(lower: string[]): string[] | null {
  if (lower.length <= OBJECTS_DIR.length || !OBJECTS_DIR.every((name, i) => lower[i] === name)) return null;
  return lower.slice(OBJECTS_DIR.length);
}

/** A path as a key to compare by: without case on Windows, as its file system does. */
function pathKey(target: string): string {
  return process.platform === "win32" ? target.toLowerCase() : target;
}

/**
 * Why a file in the ship's project (given as its names from the project's folder down) is protected, or null if it
 * isn't. Names are compared without case, as Windows does.
 */
function protectedReason(names: string[]): string | null {
  const lower = names.map((name) => name.toLowerCase());
  const [top] = lower;
  const name = names[names.length - 1];
  const lowerName = lower[lower.length - 1];
  if (lower.length > 1 && top === CODEGEN_DIR) return `${CODEGEN_DIR}/ holds earlier versions of generated code, kept by Ship Docs.`;
  if (lower.length > 1 && top === "dist") return "dist/ is build output.";
  if (lower.includes("node_modules")) return "Installed packages can't be changed.";
  if (lower.length === 1 && BUILD_FILE.test(name)) return `${name} decides how the project is built and checked, so it can't be changed.`;
  if (ENTRY_FILES.has(lower.join("/"))) {
    return `${names.join("/")} starts the shared viewer (@shipdocs/viewer-core) with this ship's data, the same in every ship, so it can't be changed.`;
  }
  if (lower.join("/").startsWith(`${CUSTOM_DIR}/`) || lower.join("/") === CUSTOM_DIR) {
    return `${CUSTOM_DIR}/ holds this ship's customizations, made by people, so it can't be changed here (it can be read).`;
  }
  if (LIBRARY_FILES.has(lowerName)) return `${name} is written by Ship Docs' Library, so it can't be changed here.`;
  if (isUploadedFile(name)) return `${name} was uploaded in the Library, so it can't be changed.`;
  const inObjects = objectsPart(lower);
  if (inObjects?.length === 1) {
    return `${names.join("/")} is the viewer's registry of objects, written by hand: use what it exports (ObjectSymbol2D, objectPort, and ObjectModel3D).`;
  }
  if (inObjects && (inObjects.length !== 2 || inObjects[1] !== OBJECT_CARD_FILE)) {
    return `${names.slice(0, OBJECTS_DIR.length + 1).join("/")}/ is an object from the Library: only its ${OBJECT_CARD_FILE} can be written there.`;
  }
  return null;
}

function isInside(root: string, target: string): boolean {
  const rel = path.relative(root, target);
  return rel !== "" && rel !== ".." && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
}

function isSameOrInside(root: string, target: string): boolean {
  return path.relative(root, target) === "" || isInside(root, target);
}

function isMissing(error: unknown): boolean {
  return ["ENOENT", "ENOTDIR"].includes(errorCode(error) ?? "");
}

/** A path as shown to the agent and in logs: with forward slashes. */
export function toLabel(target: string): string {
  return target.split(path.sep).join("/");
}

/**
 * What's wrong with a path for any file operation, or null: it must be inside `root` (both absolute), no part of it
 * below `root` may be a symlink or junction, and an existing file mustn't be hard-linked. Parts that don't exist yet
 * are fine (a file about to be created).
 */
export async function pathProblem(root: string, target: string): Promise<string | null> {
  if (!isSameOrInside(root, target)) return `${toLabel(target)} is outside ${toLabel(root)}.`;
  let current = root;
  for (const name of path.relative(root, target).split(path.sep).filter(Boolean)) {
    current = path.join(current, name);
    let stat;
    try {
      stat = await fs.lstat(current);
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }
    if (stat.isSymbolicLink()) return `${toLabel(current)} is a link (symlink or junction), and links can't be followed.`;
    if (stat.isFile() && stat.nlink > 1) return `${toLabel(current)} is hard-linked to another file, so it can't be used.`;
  }
  return null;
}

/** Throws if pathProblem finds something wrong: for the server's own file operations during a generation. */
export async function assertPlainPath(root: string, target: string): Promise<void> {
  const problem = await pathProblem(root, target);
  if (problem) throw new Error(problem);
}

/**
 * The first link (symlink or junction) or hard-linked file in a folder tree, without following any, or "too-big" if
 * it has more than `max` entries. Null if there's none. For searches, which read a whole tree.
 */
export async function scanForLinks(dir: string, max = 20_000): Promise<string | "too-big" | null> {
  let seen = 0;
  async function walk(current: string): Promise<string | "too-big" | null> {
    let entries;
    try {
      entries = await fs.readdir(current);
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }
    for (const name of entries) {
      if (++seen > max) return "too-big";
      const full = path.join(current, name);
      const stat = await fs.lstat(full).catch(() => null);
      if (!stat) continue;
      if (stat.isSymbolicLink() || (stat.isFile() && stat.nlink > 1)) return full;
      if (stat.isDirectory()) {
        const found = await walk(full);
        if (found) return found;
      }
    }
    return null;
  }
  const top = await fs.lstat(dir).catch(() => null);
  if (!top) return null;
  if (top.isSymbolicLink()) return dir;
  return top.isDirectory() ? walk(dir) : null;
}

/** Where a generation's stages are kept (see staging.ts): in child/, so packages resolve as they do for the ships. */
export const STAGES_DIR_NAME = ".codegen-stage";

export interface PolicyDirs {
  /** The ship's project folder the agent works in (its working directory): the stage's copy during a generation, the real one for the server's own changes (applying, restoring a version). */
  ship: string;
  /** The section's folder, inside `ship`. */
  section: string;
  /** The stage's folder, during a generation. */
  stage?: string;
}

/** What a generation may do with its ship's objects (see CodegenPolicy.allowObjects); all paths absolute, as pathKey keys. */
interface ObjectAccess {
  /** The objects' folders whose card.json may be written. */
  cardDirs: Set<string>;
  /** The objects' files that may be read. */
  readable: Set<string>;
}

export class CodegenPolicy {
  /** Unset: no object file may be read, and any object's card may be written (the server's own changes). */
  private objectAccess: ObjectAccess | undefined;

  private constructor(
    /** All absolute, starting with child/'s real location, and checked to have no links. */
    private readonly childDir: string,
    private readonly shipsDir: string,
    private readonly stagesDir: string,
    private readonly dirs: Required<Omit<PolicyDirs, "stage">> & { stage?: string },
  ) {}

  static async open(dirs: PolicyDirs): Promise<CodegenPolicy> {
    // child/ as the app knows it is the boundary: where it is on this machine is the machine's business, but nothing
    // below it may be a link.
    const child = path.resolve(CHILD_DIR);
    const plain = async (dir: string) => {
      const located = path.resolve(dir);
      await assertPlainPath(child, located);
      return located;
    };
    return new CodegenPolicy(child, path.join(child, COLLECTIONS.projects.dir), path.join(child, STAGES_DIR_NAME), {
      ship: await plain(dirs.ship),
      section: await plain(dirs.section),
      stage: dirs.stage ? await plain(dirs.stage) : undefined,
    });
  }

  /** The ship's folder, which relative paths are resolved against (it's the agent's working directory). */
  get root(): string {
    return this.dirs.ship;
  }

  get section(): string {
    return this.dirs.section;
  }

  /** The viewer every ship runs (child/core), which the agent reads but never changes. */
  get core(): string {
    return path.resolve(CORE_DIR);
  }

  /** child/: what the agent can reach at all. */
  get child(): string {
    return this.childDir;
  }

  /** The stage's folder, during a generation. */
  get stage(): string | undefined {
    return this.dirs.stage;
  }

  /** A path as the agent sees it: relative to the ship's folder (its working directory) inside it, else absolute. */
  label(target: string): string {
    return isSameOrInside(this.dirs.ship, target) ? path.relative(this.dirs.ship, target).split(path.sep).join("/") : toLabel(target);
  }

  /**
   * For a generation: the objects whose images it looks at, so the agent may write their cards (card.json in their
   * folders, `cardDirs`) and read those images it's told to (`readable`, e.g. SVGs). Every other object's files stay
   * unreadable, and its card unwritable. All absolute.
   */
  allowObjects(access: { cardDirs: string[]; readable: string[] }) {
    this.objectAccess = { cardDirs: new Set(access.cardDirs.map(pathKey)), readable: new Set(access.readable.map(pathKey)) };
  }

  /** Whether an absolute path is a file uploaded for an object (its image or 3D model), in this ship or another. */
  private isObjectUpload(target: string): boolean {
    let names: string[];
    if (isInside(this.dirs.ship, target)) names = path.relative(this.dirs.ship, target).split(path.sep);
    else if (isInside(this.shipsDir, target)) names = path.relative(this.shipsDir, target).split(path.sep).slice(1);
    else return false;
    const inObjects = objectsPart(names.map((name) => name.toLowerCase()));
    return inObjects?.length === 2 && isUploadedFile(inObjects[1]);
  }

  /**
   * A path the agent gave, before any use: no "..", inside child/ (relative paths are from the ship's folder), and no
   * link or hard-linked file on the way. Returns the absolute path to use, or why it's refused.
   */
  async resolve(requested: string): Promise<{ target: string } | { refused: string }> {
    if (!requested || requested.includes("\0")) return { refused: "No usable path was given." };
    if (requested.split(/[\\/]/).includes("..")) {
      return { refused: `Paths can't contain "..". Use the absolute path instead, e.g. ${toLabel(this.core)}/src/sections/types.ts.` };
    }
    const target = path.resolve(this.dirs.ship, requested);
    if (!isSameOrInside(this.childDir, target)) {
      return { refused: "Only files inside child/ can be used: the Ship Docs app (the parent) is out of reach." };
    }
    const problem = await pathProblem(this.childDir, target);
    return problem ? { refused: problem } : { target };
  }

  /** What's wrong with an absolute path now, after it was used (it may have changed since it was checked), or null. */
  async verify(target: string): Promise<string | null> {
    if (!isSameOrInside(this.childDir, target)) return `${toLabel(target)} is outside child/.`;
    return pathProblem(this.childDir, target);
  }

  /** Whether an absolute path is a ship's earlier versions of generated code (child/ships/<ship>/codegen/), or in them. */
  private inVersions(target: string): boolean {
    if (!isInside(this.shipsDir, target)) return false;
    const names = path.relative(this.shipsDir, target).split(path.sep);
    return names.length >= 2 && names[1].toLowerCase() === CODEGEN_DIR;
  }

  /** A file or folder the agent wants to read: its absolute path, or why it's refused. */
  async checkRead(requested: string): Promise<{ target: string } | { refused: string }> {
    const resolved = await this.resolve(requested);
    if ("refused" in resolved) return resolved;
    const { target } = resolved;
    // Earlier versions of sections' code aren't part of a project, and could be mistaken for it.
    if (this.inVersions(target)) return { refused: `${CODEGEN_DIR}/ holds earlier versions, not the project's code.` };
    if (isSameOrInside(this.stagesDir, target) && !(this.dirs.stage && isSameOrInside(this.dirs.stage, target))) {
      return { refused: "That's another generation's working copy." };
    }
    // Images cost many tokens each time they're sent, and models are large: the task describes the objects instead.
    if (this.isObjectUpload(target) && !this.objectAccess?.readable.has(pathKey(target))) {
      return {
        refused:
          "Objects' images and 3D models aren't read: the task describes each object (its card), and ObjectSymbol2D and ObjectModel3D show its image and model in the viewer.",
      };
    }
    return { target };
  }

  /**
   * A folder the agent wants to search (Glob, Grep), which reads the whole tree below it: checked like a read, and
   * refused if the tree holds a link or a hard-linked file, or is too big to check.
   */
  async checkSearch(requested: string): Promise<{ target: string } | { refused: string }> {
    const checked = await this.checkRead(requested);
    if ("refused" in checked) return checked;
    const found = await scanForLinks(checked.target);
    if (found === "too-big") return { refused: "That folder is too big to search. Search a smaller one, e.g. its src/." };
    if (found) return { refused: `${toLabel(found)} is a link or a hard-linked file, so ${this.label(checked.target)} can't be searched.` };
    return checked;
  }

  /** A file the agent wants to create or change: its absolute path, or why it's refused. */
  async checkWrite(requested: string): Promise<{ target: string } | { refused: string }> {
    const resolved = await this.resolve(requested);
    if ("refused" in resolved) return resolved;
    const { target } = resolved;
    if (!isInside(this.dirs.ship, target)) {
      const ship = toLabel(this.dirs.ship);
      let refused: string;
      if (isSameOrInside(this.core, target)) {
        refused =
          `${toLabel(this.core)}/ is the viewer every ship runs (@shipdocs/viewer-core), maintained by people: it can't be changed ` +
          `here. Import what it exports, and put components your sections share in ${ship}/src/shared/schematic/.`;
      } else if (isSameOrInside(path.resolve(SHIP_TEMPLATE_DIR), target)) {
        refused = "The template is what new ships are made from, maintained by people: it can't be changed here.";
      } else if (isSameOrInside(this.shipsDir, target)) {
        refused = this.dirs.stage
          ? `This generation works on a copy: write in ${ship}/ (your working directory). Other ships can't be changed.`
          : "Other ships are projects of their own, so they can't be changed.";
      } else {
        refused = `Only this ship's project (${ship}/) can be changed.`;
      }
      return { refused };
    }
    const names = path.relative(this.dirs.ship, target).split(path.sep);
    if (!names.every((name) => SAFE_NAME.test(name) && !name.endsWith("."))) {
      return { refused: "Use plain file and folder names: letters, digits, '.', '_' and '-'." };
    }
    const refused = protectedReason(names);
    if (refused) return { refused };
    if (objectsPart(names.map((name) => name.toLowerCase()))) {
      if (this.objectAccess && !this.objectAccess.cardDirs.has(pathKey(path.dirname(target)))) {
        return {
          refused: `Only the cards of the objects whose images this task shows you can be written. The others already have theirs, or are looked at in a later generation.`,
        };
      }
    }
    return { target };
  }
}

/** Glob patterns may only search below the folder they're given. */
export function checkPattern(pattern: string): string | null {
  if (path.isAbsolute(pattern) || /^[A-Za-z]:/.test(pattern) || pattern.split(/[\\/]/).includes("..")) {
    return "Use a pattern relative to the folder searched, without '..'.";
  }
  return null;
}

interface Original {
  /** The file's content before the run, or null if it didn't exist. */
  content: Buffer | null;
  /** For a file that didn't exist: its deepest folder that did, which undoing the run never removes. */
  existingDir?: string;
}

async function deepestExisting(dir: string): Promise<string> {
  for (;;) {
    try {
      await fs.stat(dir);
      return dir;
    } catch (error) {
      if (!isMissing(error)) throw error;
      const parent = path.dirname(dir);
      if (parent === dir) return dir;
      dir = parent;
    }
  }
}

/**
 * Remembers each file's content from before its first change, so changes can be listed (what a generation changed in
 * its stage) and undone (applying a stage, restoring a version): changed files get their old content back, and new
 * files are removed, with the folders created for them. Every path is checked before it's written.
 */
export class FileJournal {
  /** By absolute path, in the order they were first written. */
  private readonly originals = new Map<string, Original>();

  constructor(private readonly policy: CodegenPolicy) {}

  async remember(target: string) {
    if (this.originals.has(target)) return;
    try {
      this.originals.set(target, { content: await fs.readFile(target) });
    } catch (error) {
      if (!isMissing(error)) throw error;
      this.originals.set(target, { content: null, existingDir: await deepestExisting(path.dirname(target)) });
    }
  }

  /** Deletes a file in the section's folder (and the folders there it leaves empty), remembering it first so restore() can put it back. */
  async remove(target: string) {
    await assertPlainPath(this.policy.child, target);
    await this.remember(target);
    await fs.rm(target, { force: true });
    await removeEmptyFolders(path.dirname(target), this.policy.section);
  }

  /** Whether a file in `dir` (absolute) was written, or about to be. */
  hasFilesIn(dir: string): boolean {
    return [...this.originals.keys()].some((target) => isInside(dir, target));
  }

  /**
   * The files in `dir` (absolute) that differ from before, in the order they were first written, with their content
   * before and now (null: it didn't, or doesn't, exist).
   */
  async changesIn(dir: string): Promise<{ target: string; before: Buffer | null; after: Buffer | null }[]> {
    const changes: { target: string; before: Buffer | null; after: Buffer | null }[] = [];
    for (const [target, { content: before }] of this.originals) {
      if (!isInside(dir, target)) continue;
      const after = await fs.readFile(target).catch(() => null);
      if (after === null ? before !== null : before === null || !after.equals(before)) changes.push({ target, before, after });
    }
    return changes;
  }

  /** The files that differ from before, as the agent sees them (policy.label), sorted. */
  async changedFiles(): Promise<string[]> {
    return (await this.changesIn(this.policy.child)).map(({ target }) => this.policy.label(target)).sort();
  }

  /** Puts every file back as it was before. Keeps going past a file that can't be restored, then throws. */
  restore(): Promise<void> {
    return this.restoreWhere(() => true);
  }

  /** Puts the files in `dir` (absolute) back as they were before, e.g. an object card that's left out; the others stay. */
  restoreIn(dir: string): Promise<void> {
    return this.restoreWhere((target) => isInside(dir, target));
  }

  /**
   * Puts the selected files back as they were, the last written first, so a folder created for several new files is
   * removed with the last of them, and forgets them. Keeps going past a file that can't be restored, then throws.
   */
  private async restoreWhere(selected: (target: string) => boolean) {
    const failures: unknown[] = [];
    for (const [target, { content, existingDir }] of [...this.originals].reverse()) {
      if (!selected(target)) continue;
      this.originals.delete(target);
      try {
        await assertPlainPath(this.policy.child, target);
        if (content !== null) {
          await fs.mkdir(path.dirname(target), { recursive: true });
          await writeAtomic(target, content);
        } else {
          await fs.rm(target, { force: true });
          await removeEmptyFolders(path.dirname(target), existingDir ?? this.policy.root);
        }
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length) throw new AggregateError(failures, "Some files couldn't be put back.");
  }
}

/** Removes `dir` and its parents while they're empty, stopping at `stop`, which is never removed. */
async function removeEmptyFolders(dir: string, stop: string) {
  while (isInside(stop, dir)) {
    try {
      await fs.rmdir(dir);
    } catch {
      return; // not empty, or already gone
    }
    dir = path.dirname(dir);
  }
}
