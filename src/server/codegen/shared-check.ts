import fs from "node:fs/promises";
import path from "node:path";
import { newDiagnostics, typecheckVariants, type Diagnostic } from "./typecheck";

/**
 * Checks a generation's change to the template's shared code (child/template/) against the existing ships.
 *
 * Ships don't import the template: each was copied from it when it was created, so each has its own copy of the
 * shared code, and the template's changes only reach ships created later. A ship "uses" a changed file when it has
 * its own file at the same place, and the check is whether the ship would still type-check with the change applied
 * to it, as it would be if the change were copied over. Nothing in the ship is written: it's type-checked twice with
 * files replaced in memory, once with the changed files as the template had them before the run, and once as they
 * are now, so only the errors the change itself brings count, not differences the ship already had from the template.
 */

/** A file the run changed in the template: relative to the template's folder with forward slashes, and its content before and after (null: it didn't, or doesn't, exist). */
export interface TemplateChange {
  file: string;
  before: string | null;
  after: string | null;
}

export interface ShipToCheck {
  name: string;
  /** Absolute path of its project folder. */
  dir: string;
}

export interface SharedCheckResult {
  /** The ships that have changed files, and so were checked. */
  checked: ShipToCheck[];
  /** The ones the change would break, with the new type errors (files relative to that ship's folder). */
  broken: { ship: ShipToCheck; errors: Diagnostic[] }[];
  /** The ones that couldn't be checked, with why. */
  unchecked: { ship: ShipToCheck; reason: string }[];
}

/** Only src/ is type-checked (tsconfig.app.json), so changes elsewhere, like index.html, can't break a ship's build. */
function isChecked(file: string): boolean {
  return file.startsWith("src/");
}

async function isFile(file: string): Promise<boolean> {
  return fs.stat(file).then(
    (stat) => stat.isFile(),
    () => false,
  );
}

/** Checks the changes against each ship in turn (each check is a TypeScript program, so they don't run at once). */
export async function checkSharedChange(changes: TemplateChange[], ships: ShipToCheck[], signal?: AbortSignal): Promise<SharedCheckResult> {
  const result: SharedCheckResult = { checked: [], broken: [], unchecked: [] };
  const relevant = changes.filter((change) => isChecked(change.file));
  if (relevant.length === 0) return result;

  for (const ship of ships) {
    signal?.throwIfAborted();
    const at = (file: string) => path.join(ship.dir, ...file.split("/"));
    const before: Record<string, string | null> = {};
    const after: Record<string, string | null> = {};
    let uses = false;
    for (const change of relevant) {
      const target = at(change.file);
      const exists = await isFile(target);
      if (change.before !== null) {
        // A file the template had: the ship uses the change if it has its own copy.
        if (!exists) continue;
        uses = true;
        before[target] = change.before;
        after[target] = change.after;
      } else if (!exists && change.after !== null) {
        // A new file, which the changed files may import. A ship that already has its own file there keeps it.
        after[target] = change.after;
      }
    }
    if (!uses) continue;

    result.checked.push(ship);
    try {
      const [withoutChange, withChange] = await typecheckVariants(ship.dir, [before, after], signal);
      const errors = newDiagnostics(withoutChange, withChange);
      if (errors.length) result.broken.push({ ship, errors });
    } catch (error) {
      if (signal?.aborted) throw error;
      result.unchecked.push({ ship, reason: error instanceof Error ? error.message : String(error) });
    }
  }
  return result;
}
