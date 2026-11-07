import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { CHILD_DIR } from "@/server/child-dir";

/** A type error tsc found in a ship's project. */
export interface Diagnostic {
  /** Relative to the ship's folder, with forward slashes; empty for errors not tied to a file. */
  file: string;
  line: number;
  column: number;
  /** E.g. "TS2322". */
  code: string;
  message: string;
}

const TIMEOUT_MS = 3 * 60 * 1000;
/** As printed with --pretty false: `src/app/App.tsx(12,5): error TS2322: Type ...`. Wrapped message lines are indented. */
const FILE_ERROR = /^(.+)\((\d+),(\d+)\): error (TS\d+): (.*)$/;
const GLOBAL_ERROR = /^error (TS\d+): (.*)$/;
/** The most errors shown to the agent at once. */
const SHOWN_MAX = 60;

/** tsc from the child toolchain, as child/build-ships.mjs runs it. */
function tscPath(): string {
  return createRequire(path.join(CHILD_DIR, "package.json")).resolve("typescript/bin/tsc");
}

/** Type-checks a ship's project the way its build does (tsconfig.app.json, so src/), without writing anything. */
export async function typecheck(shipDir: string): Promise<Diagnostic[]> {
  const args = [tscPath(), "-p", path.join(shipDir, "tsconfig.app.json"), "--noEmit", "--pretty", "false"];
  const output = await new Promise<string>((resolve, reject) => {
    execFile(
      process.execPath,
      args,
      { cwd: shipDir, timeout: TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024, windowsHide: true },
      (error, stdout, stderr) => {
        // tsc exits with 1 or 2 when it finds errors, and prints them on stdout.
        if (error && (error.killed || !stdout.trim())) {
          reject(new Error(`The type check couldn't run: ${(stderr || error.message).trim()}`));
        } else {
          resolve(stdout);
        }
      },
    );
  });
  return parseDiagnostics(output);
}

function parseDiagnostics(output: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const line of output.split(/\r?\n/)) {
    const inFile = FILE_ERROR.exec(line);
    const global = inFile ? null : GLOBAL_ERROR.exec(line);
    if (inFile) {
      const [, file, row, column, code, message] = inFile;
      diagnostics.push({ file: file.split(path.sep).join("/"), line: Number(row), column: Number(column), code, message });
    } else if (global) {
      diagnostics.push({ file: "", line: 0, column: 0, code: global[1], message: global[2] });
    } else if (/^\s+\S/.test(line) && diagnostics.length) {
      diagnostics[diagnostics.length - 1].message += `\n${line.trimEnd()}`;
    }
  }
  return diagnostics;
}

/** Line numbers move as files change, so errors are matched by file, code and message. */
function keyOf(diagnostic: Diagnostic): string {
  return `${diagnostic.file}|${diagnostic.code}|${diagnostic.message}`;
}

/** The errors in `after` that weren't in `before`. */
export function newDiagnostics(before: Diagnostic[], after: Diagnostic[]): Diagnostic[] {
  const known = new Set(before.map(keyOf));
  return after.filter((diagnostic) => !known.has(keyOf(diagnostic)));
}

export function formatDiagnostics(diagnostics: Diagnostic[]): string {
  const shown = diagnostics.slice(0, SHOWN_MAX).map(({ file, line, column, code, message }) =>
    file ? `${file}(${line},${column}): ${code}: ${message}` : `${code}: ${message}`,
  );
  if (diagnostics.length > SHOWN_MAX) shown.push(`…and ${diagnostics.length - SHOWN_MAX} more.`);
  return shown.join("\n");
}

/** What the agent's typecheck tool reports: the errors to fix, apart from the ones the project had before it started. */
export function typecheckReport(current: Diagnostic[], baseline: Diagnostic[]): string {
  if (current.length === 0) return "No type errors.";
  const fresh = newDiagnostics(baseline, current);
  const old = current.length - fresh.length;
  return [
    fresh.length ? `${fresh.length} type error(s) to fix:\n${formatDiagnostics(fresh)}` : "No new type errors.",
    old ? `${old} other error(s) were already in the project before you started. Leave them unless they're in your files.` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}
