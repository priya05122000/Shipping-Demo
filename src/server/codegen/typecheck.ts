import { execFile, spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { CHILD_DIR } from "@/server/child-dir";
import { dataBlock } from "./untrusted";

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

function vitePath(): string {
  const entry = createRequire(path.join(CHILD_DIR, "package.json")).resolve("vite");
  return path.resolve(path.dirname(entry), "../../bin/vite.js");
}

/** Bundles a staged viewer with the trusted Vite configuration and installed child dependencies. */
export async function buildViewer(shipDir: string, signal?: AbortSignal): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    execFile(
      process.execPath,
      [vitePath(), "build"],
      { cwd: shipDir, timeout: TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024, windowsHide: true, signal },
      (error, stdout, stderr) => {
        if (error) {
          const output = `${stdout}\n${stderr}`
            .replaceAll(shipDir, "the staged viewer")
            .trim()
            .split(/\r?\n/)
            .slice(-12)
            .join("\n");
          reject(new Error(`The viewer build failed${output ? `:\n${output}` : `: ${error.message}`}`));
        } else {
          resolve();
        }
      },
    );
  });
}

/**
 * Type-checks a ship's project the way its build does (tsconfig.app.json, so src/), without writing anything.
 * Aborting `signal` stops tsc.
 */
export async function typecheck(shipDir: string, signal?: AbortSignal): Promise<Diagnostic[]> {
  const args = [tscPath(), "-p", path.join(shipDir, "tsconfig.app.json"), "--noEmit", "--pretty", "false"];
  const output = await new Promise<string>((resolve, reject) => {
    execFile(
      process.execPath,
      args,
      { cwd: shipDir, timeout: TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024, windowsHide: true, signal },
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

/** See the script's own comment. Run from the source folder, like the prompts (see prompts.ts). */
const OVERLAY_SCRIPT = path.join(process.cwd(), "src", "server", "codegen", "overlay-typecheck.mjs");

/**
 * Type-checks a project the way typecheck() does, once per variant, with the variant's files replaced in memory (by
 * absolute path; null for a file that doesn't exist), and writes nothing. Returns each variant's errors, with files
 * relative to the project. Aborting `signal` stops it.
 */
export function typecheckVariants(
  projectDir: string,
  variants: Record<string, string | null>[],
  signal?: AbortSignal,
): Promise<Diagnostic[][]> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [OVERLAY_SCRIPT, CHILD_DIR], {
      cwd: projectDir,
      timeout: TIMEOUT_MS * variants.length,
      windowsHide: true,
      signal,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => (stdout += chunk));
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => (stderr += chunk));
    // The script may end before reading all of its input; the exit code says what happened.
    child.stdin.on("error", () => undefined);
    child.on("error", reject);
    child.on("close", (code) => {
      const problem = (stderr.trim().split(/\r?\n/).slice(-3).join(" ") || `exit code ${code}`).trim();
      if (code !== 0) return reject(new Error(`The type check couldn't run: ${problem}`));
      try {
        resolve(JSON.parse(stdout) as Diagnostic[][]);
      } catch {
        reject(new Error(`The type check gave no result: ${problem}`));
      }
    });
    child.stdin.end(JSON.stringify({ project: projectDir, variants }));
  });
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

/** Type errors for the agent, as a block of data: their messages quote the code, which isn't to be trusted. */
export function diagnosticsBlock(diagnostics: Diagnostic[]): string {
  return dataBlock(formatDiagnostics(diagnostics));
}

export interface CheckOptions {
  /** Aborting it stops every check. */
  signal?: AbortSignal;
  /**
   * Put before each error's file, so paths are relative to the ship's folder as the agent sees them, e.g.
   * "../../template/" for the template's errors.
   */
  prefix?: string;
}

async function checkProject(projectDir: string, { signal, prefix = "" }: CheckOptions): Promise<Diagnostic[]> {
  const diagnostics = await typecheck(projectDir, signal);
  return prefix ? diagnostics.map((diagnostic) => (diagnostic.file ? { ...diagnostic, file: prefix + diagnostic.file } : diagnostic)) : diagnostics;
}

/**
 * The type checks of one project (a ship's, or the template) during a code generation: its errors from before the
 * run (`baseline`), and checks of its files as they are now, for the agent's typecheck tool, the check after each file
 * it writes, and the check before it finishes. Checks run one at a time, since each sees the whole project: a caller
 * that arrives while one is running gets the next one, which starts after the caller's own writes, and shares it with
 * every caller until it starts.
 */
export class TypeChecker {
  /** The check running now, if any. Never rejects. */
  private running: Promise<unknown> = Promise.resolve();
  /** The check waiting for `running` to finish, shared by the callers that arrive until it starts. */
  private waiting?: Promise<Diagnostic[]>;

  private constructor(
    private readonly projectDir: string,
    readonly baseline: Diagnostic[],
    private readonly options: CheckOptions,
  ) {}

  /** Takes the baseline: the errors the project has before the run. */
  static async open(projectDir: string, options: CheckOptions = {}): Promise<TypeChecker> {
    return new TypeChecker(projectDir, await checkProject(projectDir, options), options);
  }

  /** The project's type errors, with every file written before the call. */
  current(): Promise<Diagnostic[]> {
    if (!this.waiting) {
      const check = this.running.then(() => {
        // Started: a later caller's writes may come after it, so they need the next check.
        this.waiting = undefined;
        return checkProject(this.projectDir, this.options);
      });
      this.waiting = check;
      this.running = check.catch(() => undefined);
    }
    return this.waiting;
  }

  /** The project's type errors that weren't there before the run. */
  async fresh(): Promise<Diagnostic[]> {
    return newDiagnostics(this.baseline, await this.current());
  }

  /** What the agent's typecheck tool reports. */
  async report(): Promise<string> {
    return typecheckReport(await this.current(), this.baseline);
  }
}

/** What the agent's typecheck tool reports: the errors to fix, apart from the ones the project had before it started. */
export function typecheckReport(current: Diagnostic[], baseline: Diagnostic[]): string {
  if (current.length === 0) return "No type errors.";
  const fresh = newDiagnostics(baseline, current);
  const old = current.length - fresh.length;
  return [
    fresh.length ? `${fresh.length} type error(s) to fix:\n${diagnosticsBlock(fresh)}` : "No new type errors.",
    old ? `${old} other error(s) were already in the project before you started. Leave them unless they're in your files.` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}
