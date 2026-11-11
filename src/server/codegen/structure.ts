import fs from "node:fs/promises";
import path from "node:path";
import { CODEGEN_DIR } from "@/lib/codegen";
import { toLabel } from "./policy";

/**
 * The ship's project as the agent sees it before it starts: its file tree, and the shared viewer's (child/core), for
 * the prompt, so the agent works from the real structure, and the files it must read before it writes anything.
 */

/** Folders never listed: installed packages, build output and Git. */
const SKIP_ANYWHERE = new Set(["node_modules", "dist", ".git"]);
/** Top-level folders never listed: Ship Docs' records of code generations, which the agent can't read (see policy.ts). */
const SKIP_AT_TOP = new Set([CODEGEN_DIR]);
/** The most lines in the tree; a bigger project is cut off, and the agent can use Glob for the rest. */
const MAX_LINES = 400;

/**
 * The viewer's contract for a section's views (SectionViewProps), in the shared viewer (child/core), which generated
 * code imports as "@shipdocs/viewer-core/diagram".
 */
export const VIEW_CONTRACT_FILE = "src/sections/types.ts";

/**
 * A project folder (a ship's, or the shared viewer's) as an indented tree: folders first (ending in "/"), then files,
 * each sorted by name. Symlinks and junctions are left out. A folder in `collapsed` (absolute path → note, e.g. a
 * section's earlier version) is listed with its note instead of its files.
 */
export async function projectTree(projectDir: string, collapsed: ReadonlyMap<string, string> = new Map()): Promise<string> {
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
      const full = path.join(dir, entry.name);
      const note = entry.isDirectory() ? collapsed.get(full) : undefined;
      lines.push(`${"  ".repeat(depth)}${entry.name}${entry.isDirectory() ? "/" : ""}${note ? `  (${note})` : ""}`);
      if (entry.isDirectory() && !note) await walk(full, depth + 1);
    }
  }

  await walk(projectDir, 0);
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
 * What the agent must read before its first write, as it names files (policy.label: relative to the ship's folder, or
 * absolute outside it); one ending in "/" means any file in that folder: the viewer's contract for the views (in the
 * shared viewer, `coreDir`), and the ship's shared components once it has some, so new code builds on what's there
 * instead of starting over. Only what exists is required.
 */
export async function requiredReads(shipDir: string, sharedDir: string, coreDir: string): Promise<string[]> {
  const required: string[] = [];
  const contract = path.join(coreDir, ...VIEW_CONTRACT_FILE.split("/"));
  if (await exists(contract)) required.push(toLabel(contract));
  if (await hasTypeScript(path.join(shipDir, ...sharedDir.split("/")))) required.push(`${sharedDir}/`);
  return required;
}
