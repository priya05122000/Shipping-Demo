import fs from "node:fs/promises";
import path from "node:path";
import { CODEGEN_DIR } from "@/lib/codegen";
import { CHILD_DIR, errorCode, writeAtomic } from "@/server/child-dir";
import { assertPlainPath, CodegenPolicy, FileJournal, pathProblem, STAGES_DIR_NAME, toLabel } from "./policy";

/**
 * A generation works on a copy of its ship, its stage, and the real ship changes only once the code is checked:
 *   child/.codegen-stage/<run ID>/ships/<ship folder>/   the ship's project, without node_modules, dist and codegen/
 * It's in child/ so packages (@shipdocs/viewer-core among them) resolve as they do for the real ships; the editor and
 * git leave it out. The agent reads and writes there, so the real ship never holds half-written code, and discarding a
 * generation (it failed, was stopped, or hit a limit) is just removing its stage. applyStage copies the changes over,
 * checking each path again right before it's written and refusing a file that changed meanwhile.
 * Links (symlinks, junctions) and hard-linked files aren't copied, so the stage starts with none.
 */

const STAGES_DIR = path.join(CHILD_DIR, STAGES_DIR_NAME);
/** Never copied: installed packages, build output, Git, and TypeScript's build info. */
const SKIP_NAMES = new Set(["node_modules", "dist", ".git"]);

export interface Stage {
  /** The stage's folder. */
  dir: string;
  /** The copies the agent works on. */
  ship: string;
  section: string;
  /** The real folders they were copied from. */
  realShip: string;
  realSection: string;
}

/** Copies a folder tree, leaving out links, hard-linked files and `skip` (names, compared without case, relative to the top). */
async function copyTree(from: string, to: string, skipAtTop: Set<string>) {
  async function walk(source: string, target: string, top: boolean) {
    await fs.mkdir(target, { recursive: true });
    for (const name of await fs.readdir(source)) {
      const lower = name.toLowerCase();
      if (SKIP_NAMES.has(lower) || (top && skipAtTop.has(lower)) || lower.endsWith(".tsbuildinfo")) continue;
      const full = path.join(source, name);
      const stat = await fs.lstat(full);
      if (stat.isSymbolicLink()) continue;
      if (stat.isDirectory()) await walk(full, path.join(target, name), false);
      else if (stat.isFile() && stat.nlink === 1) await fs.copyFile(full, path.join(target, name), fs.constants.COPYFILE_EXCL);
    }
  }
  await walk(from, to, true);
}

/** Removes a folder tree without ever following a link in it: links are removed themselves first. */
export async function removeTree(dir: string) {
  async function unlinkLinks(current: string) {
    let names: string[];
    try {
      names = await fs.readdir(current);
    } catch {
      return;
    }
    for (const name of names) {
      const full = path.join(current, name);
      const stat = await fs.lstat(full).catch(() => null);
      if (stat?.isSymbolicLink()) await fs.unlink(full).catch(() => fs.rmdir(full));
      else if (stat?.isDirectory()) await unlinkLinks(full);
    }
  }
  const top = await fs.lstat(dir).catch(() => null);
  if (!top) return;
  if (top.isSymbolicLink()) return fs.unlink(dir);
  await unlinkLinks(dir);
  await fs.rm(dir, { recursive: true, force: true });
}

/** Copies the ship's project into a new stage. */
export async function createStage(runId: string, shipDir: string, sectionDir: string): Promise<Stage> {
  await assertPlainPath(CHILD_DIR, shipDir);
  await assertPlainPath(CHILD_DIR, sectionDir);
  const dir = path.join(STAGES_DIR, runId);
  await removeTree(dir);
  const ship = path.join(dir, path.relative(CHILD_DIR, shipDir));
  try {
    await copyTree(shipDir, ship, new Set([CODEGEN_DIR]));
  } catch (error) {
    await removeTree(dir);
    throw error;
  }
  return {
    dir,
    ship,
    section: path.join(ship, path.relative(shipDir, sectionDir)),
    realShip: shipDir,
    realSection: sectionDir,
  };
}

export async function discardStage(stage: Stage) {
  await removeTree(stage.dir);
}

/** Removes every stage left over: generations run one at a time, so any stage but the running one's is from a stopped server. */
export async function discardStaleStages(keep?: string) {
  let names: string[];
  try {
    names = await fs.readdir(STAGES_DIR);
  } catch (error) {
    if (errorCode(error) === "ENOENT") return;
    throw error;
  }
  for (const name of names) {
    const dir = path.join(STAGES_DIR, name);
    if (dir !== keep) await removeTree(dir);
  }
}

/** The real file a file in the stage stands for. */
function toReal(stage: Stage, staged: string): string {
  const rel = path.relative(stage.ship, staged);
  if (rel && !rel.startsWith("..") && !path.isAbsolute(rel)) return path.join(stage.realShip, rel);
  throw new Error(`${toLabel(staged)} isn't in the stage's ship.`);
}

function sameContent(a: Buffer | null, b: Buffer | null): boolean {
  return a === null || b === null ? a === b : a.equals(b);
}

/** A real file changed while the code was generated, so the stage can't be applied. */
export class StageConflict extends Error {}

export interface AppliedStage {
  /** The real files written, absolute. */
  files: string[];
  /** Puts them back as they were, e.g. when a later step fails. */
  undo: () => Promise<void>;
}

/**
 * Applies the stage's changes (as its journal recorded them) to the real ship:
 *   1. every change is checked first, before anything is written: its real path must pass the same rules as the
 *      agent's writes (realPolicy: no "..", no links, not protected), and the real file must still be as it was when
 *      the stage was copied. Otherwise nothing is written (a StageConflict for a changed file).
 *   2. each file is then written in one step (a temporary file renamed over it, so a link put in its place isn't
 *      followed), its path checked again right before and right after.
 * If anything fails, what was written is put back.
 */
export async function applyStage(stage: Stage, journal: FileJournal, realPolicy: CodegenPolicy): Promise<AppliedStage> {
  const changes = await journal.changesIn(stage.dir);
  const planned: { real: string; before: Buffer | null; after: Buffer | null }[] = [];
  for (const { target, before, after } of changes) {
    const real = toReal(stage, target);
    const checked = await realPolicy.checkWrite(real);
    if ("refused" in checked) throw new Error(`${toLabel(real)} can't be written: ${checked.refused}`);
    // A ship's file in child/, read at run time: the build mustn't trace it (an unknown path would bundle the project).
    const current = await fs.readFile(/*turbopackIgnore: true*/ real).catch(() => null);
    if (!sameContent(current, before)) {
      throw new StageConflict(
        `${toLabel(path.relative(CHILD_DIR, real))} changed while the code was being generated, so none of it was applied. Generate again.`,
      );
    }
    planned.push({ real, before, after });
  }

  const written = new FileJournal(realPolicy);
  try {
    for (const { real, after } of planned) {
      await assertPlainPath(realPolicy.child, real);
      await written.remember(real);
      if (after === null) {
        await fs.rm(real, { force: true });
      } else {
        await fs.mkdir(path.dirname(real), { recursive: true });
        await assertPlainPath(realPolicy.child, real);
        await writeAtomic(real, after);
      }
      const problem = await pathProblem(realPolicy.child, real);
      if (problem) throw new Error(`${problem} It changed while the generated code was being applied.`);
    }
  } catch (error) {
    await written.restore();
    throw error;
  }
  return { files: planned.map(({ real }) => real), undo: () => written.restore() };
}
