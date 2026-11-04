import { getExtension } from "@/lib/files";

/**
 * Rules for the /editor page, which edits the child app's source (./child). Shared by the API routes and the UI.
 * Paths are relative to the child folder and use "/", e.g. "src/app/App.tsx".
 */

/** Largest file the editor opens or saves. */
export const CHILD_FILE_MAX_BYTES = 1024 * 1024;

/** Never listed, opened or written: installed packages and git internals. Compared case-insensitively. */
const HIDDEN_NAMES = new Set(["node_modules", ".git"]);

/** Shown in the file tree but not opened as text. The server also refuses any file that isn't UTF-8 text. */
const BINARY_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "avif", "ico", "bmp",
  "glb", "fbx", "blend", "pdf", "zip", "wasm",
  "woff", "woff2", "ttf", "otf", "eot", "mp3", "mp4", "webm",
]);

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
