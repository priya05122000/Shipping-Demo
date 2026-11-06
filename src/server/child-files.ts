import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  CHILD_FILE_MAX_BYTES,
  isHiddenName,
  type ChildEntry,
  type ChildFile,
  type ChildScope,
} from "@/lib/child-files";
import { COLLECTIONS, projectDir } from "@/lib/collection-defs";
import { formatBytes } from "@/lib/files";
import { CHILD_DIR, errorCode, writeAtomic } from "@/server/child-dir";
import { ApiError } from "@/server/storage";

/**
 * File access for the editor pages, confined to the child app's folder:
 *   - paths are checked name by name, so "..", absolute paths and Windows tricks ("name.", "a:stream", "CON")
 *     can't name anything outside ./child
 *   - each path's real location (after symlinks, junctions and short names) must still be inside ./child, and
 *     inside the editor's scope: the shared files for /editor, or one ship's folder for its Editor page
 *   - node_modules and .git are never listed, read or written
 */
const NAME_MAX = 255;

/** Shown for unexpected errors (see respond()). */
export const CHILD_FILES_FAILURE = "Something went wrong while accessing the child app's files.";

/** Path separators, characters Windows doesn't allow in names (":" would also open NTFS streams), and control characters. */
const BAD_CHARS = /[<>:"/\\|?*\x00-\x1f]/;
/** Windows device names, which open a device instead of a file, with or without an extension. */
const DEVICE_NAME = /^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i;
/** Temporary files that writeAtomic creates while saving. */
const TEMP_NAME = /^\..+\.[0-9a-f]{8}\.tmp$/;

const UTF8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

function isValidName(name: string): boolean {
  return (
    name !== "" &&
    name !== "." &&
    name !== ".." &&
    name.length <= NAME_MAX &&
    !BAD_CHARS.test(name) &&
    // Windows drops trailing dots and spaces, so "node_modules." would open node_modules.
    !/[. ]$/.test(name) &&
    !DEVICE_NAME.test(name)
  );
}

function isListed(name: string): boolean {
  return isValidName(name) && !isHiddenName(name) && !TEMP_NAME.test(name);
}

function notFound(relPath: string) {
  return new ApiError(404, `${relPath} wasn't found in the child app.`);
}

function isInside(root: string, target: string): boolean {
  const rel = path.relative(root, target);
  return rel !== ".." && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
}

/** The editor's scope, from `?project=<folder>` on a ship's Editor page. None means /editor (see ChildScope). */
export function scopeOf(request: Request): ChildScope {
  return new URL(request.url).searchParams.get("project");
}

interface Scope {
  /** The folder the scope's paths are relative to: ./child for the shared files, ./child/ships for a ship. */
  base: string;
  /** The folder the scope's files are listed from: ./child, or the ship's project folder. */
  dir: string;
  /** `dir` relative to `base`, which every path in the scope starts with: "" or the ship's folder, e.g. "mv-aurora". */
  prefix: string;
  /** The real location of ./child. */
  childReal: string;
  /** Whether a real location inside ./child is in the scope. */
  contains: (real: string) => boolean;
}

async function openScope(scope: ChildScope): Promise<Scope> {
  const childReal = await fs.realpath(CHILD_DIR).catch((error) => {
    if (errorCode(error) === "ENOENT") throw new ApiError(404, "The child app folder (./child) wasn't found.");
    throw error;
  });
  if (scope === null) {
    // Each ship's folder is edited from that ship's Editor page instead.
    const ships = path.join(childReal, COLLECTIONS.projects.dir);
    return { base: CHILD_DIR, dir: CHILD_DIR, prefix: "", childReal, contains: (real) => !isInside(ships, real) };
  }
  if (!isListed(scope)) throw new ApiError(400, `"${scope}" isn't a valid ship folder name.`);
  const missing = () => new ApiError(404, `This ship's folder (child/${projectDir(scope)}) wasn't found.`);
  // A ship's paths start with its folder, e.g. "mv-aurora/src/main.tsx", not "ships/mv-aurora/src/main.tsx".
  const base = path.join(CHILD_DIR, COLLECTIONS.projects.dir);
  const dir = path.join(base, scope);
  const shipReal = await fs.realpath(dir).catch((error) => {
    if (["ENOENT", "ENOTDIR"].includes(errorCode(error) ?? "")) throw missing();
    throw error;
  });
  if (!isInside(childReal, shipReal) || !(await fs.stat(shipReal)).isDirectory()) throw missing();
  return { base, dir, prefix: scope, childReal, contains: (real) => isInside(shipReal, real) };
}

/**
 * Turns URL path segments (relative to the scope's base) into an absolute path inside ./child and the editor's scope,
 * or throws. The path doesn't have to exist yet.
 */
async function resolvePath(scopeName: ChildScope, segments: string[]): Promise<{ target: string; relPath: string; scope: Scope }> {
  const relPath = segments.join("/");
  if (segments.length === 0) throw new ApiError(400, "A file path is required.");
  if (!segments.every(isValidName)) throw new ApiError(400, `"${relPath}" isn't a valid path in the child app.`);
  if (!segments.every(isListed)) throw notFound(relPath);

  const scope = await openScope(scopeName);
  const target = path.join(scope.base, ...segments);
  // Check where the deepest existing part of the path really is, so a link inside ./child can't lead out of it.
  let existing = target;
  let real: string | null = null;
  while (real === null) {
    try {
      real = await fs.realpath(existing);
    } catch (error) {
      if (!["ENOENT", "ENOTDIR"].includes(errorCode(error) ?? "") || existing === CHILD_DIR) throw error;
      existing = path.dirname(existing);
    }
  }
  const root = scope.childReal;
  const inside = isInside(root, real) && path.relative(root, real).split(path.sep).every((name) => !isHiddenName(name));
  if (!inside) throw notFound(relPath);
  // Where the path really leads: its deepest existing part's real location, then the rest as given. Only compared,
  // never opened, so the build mustn't trace it (an unknown root would make it bundle the whole project).
  if (!scope.contains(path.join(/*turbopackIgnore: true*/ real, path.relative(existing, target)))) {
    throw new ApiError(
      403,
      scopeName === null
        ? `${relPath} is in a ship's folder. Edit it from that ship's Editor page.`
        : `${relPath} is outside this ship's folder (${scope.prefix}/).`,
    );
  }
  return { target, relPath, scope };
}

function hashOf(bytes: Buffer): string {
  return crypto.createHash("sha1").update(bytes).digest("hex");
}

function tooLarge(relPath: string) {
  return new ApiError(413, `${relPath} is too large for the editor (over ${formatBytes(CHILD_FILE_MAX_BYTES)}).`);
}

function encodeText(content: unknown, relPath: string): Buffer {
  if (typeof content !== "string") throw new ApiError(400, "File content must be text.");
  const bytes = Buffer.from(content, "utf8");
  if (bytes.length > CHILD_FILE_MAX_BYTES) throw tooLarge(relPath);
  return bytes;
}

/** UTF-8 text only. A byte-order mark is kept, so saving writes it back. */
function decodeText(bytes: Buffer, relPath: string): string {
  if (!bytes.includes(0)) {
    try {
      return UTF8.decode(bytes);
    } catch {
      // Not valid UTF-8.
    }
  }
  throw new ApiError(415, `${relPath} isn't a text file, so it can't be edited here.`);
}

/** `skip` leaves out entries of this folder (not of its subfolders) by name. */
async function listFolder(dir: string, prefix: string, skip?: (name: string) => boolean): Promise<ChildEntry[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  // Symlinks are neither files nor folders here, so they're left out.
  const visible = entries.filter(
    (entry) => (entry.isFile() || entry.isDirectory()) && isListed(entry.name) && !skip?.(entry.name),
  );
  const nodes = await Promise.all(
    visible.map(async (entry): Promise<ChildEntry | null> => {
      const entryPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return { type: "folder", name: entry.name, path: entryPath, children: await listFolder(full, entryPath) };
      }
      // Skip a file deleted while the listing was running.
      const stat = await fs.stat(full).catch(() => null);
      return stat && { type: "file", name: entry.name, path: entryPath, size: stat.size };
    }),
  );
  // Folders first, then files, each A–Z.
  return nodes
    .filter((node) => node !== null)
    .sort((a, b) =>
      a.type === b.type ? a.name.localeCompare(b.name, undefined, { numeric: true }) : a.type === "folder" ? -1 : 1,
    );
}

/** The scope's files as a tree, e.g. "template/src/main.tsx" in the shared files, or "mv-aurora/src/main.tsx" in a ship. */
export async function listChildFiles(scopeName: ChildScope): Promise<ChildEntry[]> {
  const scope = await openScope(scopeName);
  // The shared files leave out the folder of ships, not just its contents.
  const skip = scopeName === null ? (name: string) => name === COLLECTIONS.projects.dir : undefined;
  return listFolder(scope.dir, scope.prefix, skip);
}

export async function readChildFile(scopeName: ChildScope, segments: string[]): Promise<ChildFile> {
  const { target, relPath } = await resolvePath(scopeName, segments);
  const stat = await fs.stat(target).catch(() => null);
  if (!stat) throw notFound(relPath);
  if (!stat.isFile()) throw new ApiError(400, `${relPath} is a folder.`);
  if (stat.size > CHILD_FILE_MAX_BYTES) throw tooLarge(relPath);
  const bytes = await fs.readFile(target);
  return { path: relPath, content: decodeText(bytes, relPath), version: hashOf(bytes) };
}

/** Saves an existing file. `baseVersion` is the version it was opened at; if the file changed since, it's a 409. */
export async function saveChildFile(scopeName: ChildScope, segments: string[], content: unknown, baseVersion: unknown) {
  const { target, relPath } = await resolvePath(scopeName, segments);
  const bytes = encodeText(content, relPath);
  const stat = await fs.stat(target).catch(() => null);
  if (!stat) throw new ApiError(404, `${relPath} no longer exists.`);
  if (!stat.isFile()) throw new ApiError(400, `${relPath} is a folder.`);
  const current = await fs.readFile(target);
  // Already saved (e.g. a repeated save): nothing to write, and no conflict either.
  if (current.equals(bytes)) return { version: hashOf(bytes) };
  if (hashOf(current) !== baseVersion) throw new ApiError(409, `${relPath} changed on disk since it was opened.`);
  await writeAtomic(target, bytes, stat.mode & 0o777);
  return { version: hashOf(bytes) };
}

/** Creates a new file, and any folders missing on the way to it. */
export async function createChildFile(scopeName: ChildScope, segments: string[], content: unknown): Promise<ChildFile> {
  const { target, relPath } = await resolvePath(scopeName, segments);
  const bytes = encodeText(content, relPath);
  try {
    await fs.mkdir(path.dirname(target), { recursive: true });
  } catch (error) {
    if (["EEXIST", "ENOTDIR"].includes(errorCode(error) ?? "")) {
      throw new ApiError(409, `Can't create ${relPath}: part of that path is a file.`);
    }
    throw error;
  }
  try {
    await fs.writeFile(target, bytes, { flag: "wx" });
  } catch (error) {
    if (["EEXIST", "EISDIR"].includes(errorCode(error) ?? "")) throw new ApiError(409, `${relPath} already exists.`);
    throw error;
  }
  return { path: relPath, content: bytes.toString("utf8"), version: hashOf(bytes) };
}

/**
 * Deletes a file, then any folders that left empty (git doesn't keep empty folders either), up to the scope's
 * folder: a ship's own folder is never removed from its Editor page.
 */
export async function deleteChildFile(scopeName: ChildScope, segments: string[]) {
  const { target, relPath, scope } = await resolvePath(scopeName, segments);
  const stat = await fs.stat(target).catch(() => null);
  if (!stat) throw notFound(relPath);
  if (!stat.isFile()) throw new ApiError(400, `${relPath} is a folder. Only files can be deleted.`);
  await fs.rm(target);
  for (let dir = path.dirname(target); dir.length > scope.dir.length; dir = path.dirname(dir)) {
    try {
      await fs.rmdir(dir);
    } catch {
      break; // Not empty.
    }
  }
}
