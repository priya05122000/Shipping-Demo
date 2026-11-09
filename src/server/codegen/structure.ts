import fs from "node:fs/promises";
import path from "node:path";
import { CODEGEN_DIR } from "@/lib/codegen";

/**
 * The ship's project as the agent sees it before it starts: its file tree for the prompt, so the agent works from the
 * project's real structure, and the files it must read before it writes anything.
 */

/** Folders never listed: installed packages, build output and Git. */
const SKIP_ANYWHERE = new Set(["node_modules", "dist", ".git"]);
/** Top-level folders never listed: earlier versions of generated code, which the agent can't read (see policy.ts). */
const SKIP_AT_TOP = new Set([CODEGEN_DIR]);
/** The most lines in the tree; a bigger project is cut off, and the agent can use Glob for the rest. */
const MAX_LINES = 400;

/** The viewer's contract for a section's views (SectionViewProps), in every ship's project. */
export const VIEW_CONTRACT_FILE = "src/shared/diagram/section.ts";

/**
 * The ship's project folder as an indented tree: folders first (ending in "/"), then files, each sorted by name.
 * Symlinks and junctions are left out.
 */
export async function projectTree(shipDir: string): Promise<string> {
  const lines: string[] = [];
  let cutOff = false;

  async function walk(dir: string, depth: number) {
    const entries = (await fs.readdir(dir, { withFileTypes: true }))
      .filter((entry) =>
        entry.isDirectory()
          ? !SKIP_ANYWHERE.has(entry.name) && !(depth === 0 && SKIP_AT_TOP.has(entry.name))
          : entry.isFile(),
      )
      .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (lines.length >= MAX_LINES) {
        cutOff = true;
        return;
      }
      lines.push(`${"  ".repeat(depth)}${entry.name}${entry.isDirectory() ? "/" : ""}`);
      if (entry.isDirectory()) await walk(path.join(dir, entry.name), depth + 1);
    }
  }

  await walk(shipDir, 0);
  if (cutOff) lines.push(`… (cut off after ${MAX_LINES} lines: use Glob to see the rest)`);
  return lines.join("\n");
}

async function exists(file: string): Promise<boolean> {
  return fs.stat(file).then(
    () => true,
    () => false,
  );
}

async function hasTypeScript(dir: string): Promise<boolean> {
  const names = await fs.readdir(dir, { recursive: true }).catch(() => [] as string[]);
  return names.some((name) => /\.(ts|tsx)$/.test(name));
}

/**
 * What the agent must read before its first write, relative to the ship's folder; one ending in "/" means any file
 * in that folder: the viewer's contract for the views, and the shared components once the ship has some, so new code
 * builds on what's there instead of starting over. Only what exists is required.
 */
export async function requiredReads(shipDir: string, sharedDir: string): Promise<string[]> {
  const required: string[] = [];
  if (await exists(path.join(shipDir, ...VIEW_CONTRACT_FILE.split("/")))) required.push(VIEW_CONTRACT_FILE);
  if (await hasTypeScript(path.join(shipDir, ...sharedDir.split("/")))) required.push(`${sharedDir}/`);
  return required;
}
