import fs from "node:fs/promises";
import path from "node:path";
import { CODEGEN_DIR, CODEGEN_SHARED_DIR } from "@/lib/codegen";
import { errorCode } from "@/server/child-dir";

/**
 * What the code generation agent may touch. It can read anything in the ship's project folder, and write TypeScript
 * files only in the section's folder and the ship's shared schematic folder. Paths are checked at their real location
 * (after symlinks and junctions), so a link can't lead the agent out of the ship's folder.
 */

/** In the section's folder, files the agent may not change although they're TypeScript: written by hand (see the README). */
const PROTECTED_NAMES = new Set(["diagram.ts"]);
const WRITABLE_EXTENSION = /\.(ts|tsx)$/;

/**
 * Whether a file in a section's folder (relative to it, with forward slashes) is generated code: what the agent may
 * write there, and what a version of the section keeps.
 */
export function isGeneratedSectionFile(relPath: string): boolean {
  return WRITABLE_EXTENSION.test(relPath) && !PROTECTED_NAMES.has(relPath);
}

/** The section's generated files, relative to its folder, with forward slashes, sorted. */
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
/** One name in a path the agent writes: plain names only, so Windows tricks ("a:stream", "name.") can't sneak in. */
const SAFE_NAME = /^[A-Za-z0-9_-][A-Za-z0-9._-]*$/;

function isInside(root: string, target: string): boolean {
  const rel = path.relative(root, target);
  return rel !== "" && rel !== ".." && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
}

function isSameOrInside(root: string, target: string): boolean {
  return path.relative(root, target) === "" || isInside(root, target);
}

/** Where a path really is, even if it doesn't exist yet: its deepest existing part's real path, plus the rest. */
async function realLocation(target: string): Promise<string> {
  const missing: string[] = [];
  let existing = target;
  for (;;) {
    try {
      return path.join(await fs.realpath(existing), ...missing);
    } catch (error) {
      if (!["ENOENT", "ENOTDIR"].includes(errorCode(error) ?? "")) throw error;
      const parent = path.dirname(existing);
      if (parent === existing) throw error;
      missing.unshift(path.basename(existing));
      existing = parent;
    }
  }
}

export class CodegenPolicy {
  private constructor(
    /** Real locations. */
    private readonly shipDir: string,
    private readonly sectionDir: string,
    private readonly sharedDir: string,
    private readonly versionsDir: string,
  ) {}

  static async open(shipDir: string, sectionDir: string): Promise<CodegenPolicy> {
    const ship = await fs.realpath(shipDir);
    return new CodegenPolicy(
      ship,
      await fs.realpath(sectionDir),
      await realLocation(path.join(ship, ...CODEGEN_SHARED_DIR.split("/"))),
      await realLocation(path.join(ship, CODEGEN_DIR)),
    );
  }

  /** The ship's folder, which relative paths are resolved against (it's the agent's working directory). */
  get root(): string {
    return this.shipDir;
  }

  /** Folders never removed when a rollback leaves them empty: the section's folder, and src/shared. */
  get keepDirs(): string[] {
    return [this.sectionDir, path.dirname(this.sharedDir)];
  }

  /** A file or folder the agent wants to read or search: its real location, or why it's refused. */
  async checkRead(requested: string): Promise<{ target: string } | { refused: string }> {
    const target = await realLocation(path.resolve(this.shipDir, requested));
    if (!isSameOrInside(this.shipDir, target)) return { refused: "Only files inside the ship's project folder can be read." };
    // Earlier versions of sections' code aren't part of the project, and could be mistaken for it.
    if (isSameOrInside(this.versionsDir, target)) return { refused: `${CODEGEN_DIR}/ holds earlier versions, not the project's code.` };
    return { target };
  }

  /** A file the agent wants to create or change: its real location, or why it's refused. */
  async checkWrite(requested: string): Promise<{ target: string } | { refused: string }> {
    const target = await realLocation(path.resolve(this.shipDir, requested));
    const where = [this.sectionDir, this.sharedDir].find((dir) => isInside(dir, target));
    if (!where) {
      return {
        refused: `Files can only be written in the section's folder (${this.relative(this.sectionDir)}/) or in ${CODEGEN_SHARED_DIR}/.`,
      };
    }
    const names = path.relative(where, target).split(path.sep);
    if (!names.every((name) => SAFE_NAME.test(name) && !name.endsWith("."))) {
      return { refused: "Use plain file and folder names: letters, digits, '.', '_' and '-'." };
    }
    if (!WRITABLE_EXTENSION.test(target)) return { refused: "Only .ts and .tsx files can be written." };
    if (where === this.sectionDir && names.length === 1 && PROTECTED_NAMES.has(names[0])) {
      return { refused: `${names[0]} is written by hand, so it can't be changed.` };
    }
    return { target };
  }

  /** A path relative to the ship's folder, with forward slashes, e.g. "src/sections/bunker/Diagram2D.tsx". */
  relative(target: string): string {
    return path.relative(this.shipDir, target).split(path.sep).join("/");
  }
}

/** Glob patterns may only search below the folder they're given. */
export function checkPattern(pattern: string): string | null {
  if (path.isAbsolute(pattern) || /^[A-Za-z]:/.test(pattern) || pattern.split(/[\\/]/).includes("..")) {
    return "Use a pattern relative to the ship's project folder, without '..'.";
  }
  return null;
}

/**
 * Remembers each file's content from before the agent's first write to it, so a failed or stopped generation can be
 * undone: changed files get their old content back, and new files (and folders left empty) are removed.
 */
export class FileJournal {
  /** By real location: the content before the run, or null if the file didn't exist. */
  private readonly originals = new Map<string, Buffer | null>();

  constructor(private readonly policy: CodegenPolicy) {}

  async remember(target: string) {
    if (this.originals.has(target)) return;
    try {
      this.originals.set(target, await fs.readFile(target));
    } catch (error) {
      if (!["ENOENT", "ENOTDIR"].includes(errorCode(error) ?? "")) throw error;
      this.originals.set(target, null);
    }
  }

  /** Deletes a file (and folders it leaves empty), remembering it first so restore() can put it back. */
  async remove(target: string) {
    await this.remember(target);
    await fs.rm(target, { force: true });
    await this.removeEmptyFolders(path.dirname(target));
  }

  /** The files that differ from before the run, relative to the ship's folder, sorted. */
  async changedFiles(): Promise<string[]> {
    const changed: string[] = [];
    for (const [target, before] of this.originals) {
      const now = await fs.readFile(target).catch(() => null);
      if (now === null ? before !== null : before === null || !now.equals(before)) changed.push(this.policy.relative(target));
    }
    return changed.sort();
  }

  /** Puts every file back as it was before the run. Keeps going past a file that can't be restored, then throws. */
  async restore() {
    const failures: unknown[] = [];
    for (const [target, before] of this.originals) {
      try {
        if (before !== null) {
          await fs.mkdir(path.dirname(target), { recursive: true });
          await fs.writeFile(target, before);
        } else {
          await fs.rm(target, { force: true });
          await this.removeEmptyFolders(path.dirname(target));
        }
      } catch (error) {
        failures.push(error);
      }
    }
    this.originals.clear();
    if (failures.length) throw new AggregateError(failures, "Some generated files couldn't be rolled back.");
  }

  private async removeEmptyFolders(dir: string) {
    const { root, keepDirs } = this.policy;
    while (isInside(root, dir) && !keepDirs.some((keep) => path.relative(keep, dir) === "")) {
      try {
        await fs.rmdir(dir);
      } catch {
        return; // not empty, or already gone
      }
      dir = path.dirname(dir);
    }
  }
}
