import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * The child folder: the ships' viewers, a separate app with its own install, build and deploy (see child/README.md).
 * It holds the viewer every ship runs (core/), the template new ships are made from, and one project per ship, which
 * holds only that ship's data and generated code. This app reads and writes those folders as data: the editor edits
 * them, the Library saves ships, sections and objects into them, and code generation writes sections' code. Nothing in
 * child/ is part of this app's build.
 */
export const CHILD_DIR = path.join(process.cwd(), "child");

/** What each new ship's folder is copied from: a ship's project without data (ship.json is a placeholder). */
export const SHIP_TEMPLATE_DIR = path.join(CHILD_DIR, "template");

/**
 * The viewer every ship runs, @shipdocs/viewer-core: its UI, how it reads a ship's data, and its Vite config. Ships
 * import it, so a change here reaches every ship when it's next built. Maintained by people: code generation reads it
 * but never changes it (see codegen/policy.ts).
 */
export const CORE_DIR = path.join(CHILD_DIR, "core");

export function errorCode(error: unknown) {
  return (error as NodeJS.ErrnoException).code;
}

/** Replaces a file in one step, so the child's dev server never reloads a half-written file. */
export async function writeAtomic(target: string, bytes: Buffer | string, mode?: number) {
  const temp = path.join(path.dirname(target), `.${path.basename(target)}.${crypto.randomBytes(4).toString("hex")}.tmp`);
  await fs.writeFile(temp, bytes, { mode });
  try {
    // On Windows a virus scanner or file watcher can hold the file for a moment; retry briefly before giving up.
    for (let attempt = 1; ; attempt++) {
      try {
        await fs.rename(temp, target);
        return;
      } catch (error) {
        const busy = ["EPERM", "EACCES", "EBUSY"].includes(errorCode(error) ?? "");
        if (!busy || attempt === 5) throw error;
        await new Promise((resolve) => setTimeout(resolve, attempt * 50));
      }
    }
  } catch (error) {
    await fs.rm(temp, { force: true });
    throw error;
  }
}
