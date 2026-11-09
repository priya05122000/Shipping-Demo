import { getExtension } from "@/lib/files";

/**
 * Rules for the editor pages, which edit the child app's source (./child). Shared by the API routes and the UI.
 * Paths use "/" and are relative to the child folder, e.g. "template/src/app/App.tsx", or in a ship's editor to
 * the folder of ships, e.g. "mv-aurora/src/app/App.tsx".
 */

/** Largest file the editor opens or saves. */
export const CHILD_FILE_MAX_BYTES = 1024 * 1024;

/**
 * Never listed, opened or written: installed packages, git internals, and code generations' working copies (see
 * src/server/codegen/staging.ts), which the editor mustn't change under a running generation. Compared
 * case-insensitively.
 */
const HIDDEN_NAMES = new Set(["node_modules", ".git", ".codegen-stage"]);

/** Shown in the file tree but not opened as text. The server also refuses any file that isn't UTF-8 text. */
const BINARY_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "avif", "ico", "bmp",
  "glb", "fbx", "blend", "pdf", "zip", "wasm",
  "woff", "woff2", "ttf", "otf", "eot", "mp3", "mp4", "webm",
]);

/**
 * The part of ./child an editor works on. null is /editor: the shared files, i.e. everything but the ships (the
 * template new ships are copied from, and the dev server and build scripts). A project folder name, e.g. "mv-aurora",
 * is that ship's Editor page: only ships/mv-aurora. The server refuses any path outside the scope.
 */
export type ChildScope = string | null;

export type ChildEntry =
  | { type: "folder"; name: string; path: string; children: ChildEntry[] }
  | { type: "file"; name: string; path: string; size: number };

export interface ChildFile {
  path: string;
  content: string;
  /** Hash of the file on disk. Saves send it back, and the server refuses them if the file changed since. */
  version: string;
}

export function isHiddenName(name: string): boolean {
  return HIDDEN_NAMES.has(name.toLowerCase());
}

export function isBinaryName(name: string): boolean {
  return BINARY_EXTENSIONS.has(getExtension(name));
}
