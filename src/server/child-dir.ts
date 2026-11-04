import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

/** The child (viewer) app's folder. The editor edits its source, and the Library saves sections and objects into it. */
export const CHILD_DIR = path.join(process.cwd(), "child");

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
