// Type-checks a project the way its build does (tsconfig.app.json), with some files' content replaced in memory, and
// writes nothing: used to try a change to the template's shared code on an existing ship that has the same files,
// without changing that ship (see shared-check.ts). Runs as its own process, so the Next server isn't held up.
//
//   node overlay-typecheck.mjs <child folder>      with JSON on stdin:
//   { "project": "<absolute project folder>", "variants": [{ "<absolute file>": "<content>" | null, … }, …] }
//
// null means the file doesn't exist. Prints a JSON array with one list of type errors per variant, each
// { file, line, column, code, message }, the file relative to the project with forward slashes (as typecheck.ts
// gives them).
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const [childDir] = process.argv.slice(2);
// The TypeScript that child/build-ships.mjs builds the ships with.
const ts = createRequire(path.join(childDir, "package.json"))("typescript");
const { project, variants } = JSON.parse(fs.readFileSync(0, "utf8"));

const caseless = !ts.sys.useCaseSensitiveFileNames;
const keyOf = (file) => {
  const resolved = path.resolve(file);
  return caseless ? resolved.toLowerCase() : resolved;
};
const srcDir = path.join(project, "src");
const isSource = (file) => {
  const rel = path.relative(srcDir, path.resolve(file));
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel) && /\.(ts|tsx)$/.test(file);
};

function format(diagnostic) {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
  const code = `TS${diagnostic.code}`;
  if (!diagnostic.file) return { file: "", line: 0, column: 0, code, message };
  const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start ?? 0);
  const file = path.relative(project, diagnostic.file.fileName).split(path.sep).join("/");
  return { file, line: line + 1, column: character + 1, code, message };
}

const results = [];
for (const variant of variants) {
  const files = new Map(Object.entries(variant).map(([file, content]) => [keyOf(file), content]));
  // Folders that only exist in the variant, so module resolution finds files in them.
  const dirs = new Set();
  for (const [file, content] of Object.entries(variant)) {
    if (content === null) continue;
    for (let dir = path.dirname(path.resolve(file)); dir !== path.dirname(dir); dir = path.dirname(dir)) dirs.add(keyOf(dir));
  }
  const fileExists = (file) => (files.has(keyOf(file)) ? files.get(keyOf(file)) !== null : ts.sys.fileExists(file));
  const readFile = (file) => (files.has(keyOf(file)) ? (files.get(keyOf(file)) ?? undefined) : ts.sys.readFile(file));
  const directoryExists = (dir) => dirs.has(keyOf(dir)) || ts.sys.directoryExists(dir);

  const parsed = ts.getParsedCommandLineOfConfigFile(
    path.join(project, "tsconfig.app.json"),
    {},
    {
      ...ts.sys,
      fileExists,
      readFile,
      onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
        throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
      },
    },
  );
  if (!parsed) throw new Error(`${path.join(project, "tsconfig.app.json")} couldn't be read.`);

  // The config lists the files on disk; the variant's own files are added, and its missing ones left out.
  const rootNames = parsed.fileNames.filter((file) => fileExists(file));
  const listed = new Set(rootNames.map(keyOf));
  for (const [file, content] of Object.entries(variant)) {
    if (content !== null && isSource(file) && !listed.has(keyOf(file))) rootNames.push(path.resolve(file));
  }

  const host = ts.createCompilerHost(parsed.options);
  host.fileExists = fileExists;
  host.readFile = readFile;
  host.directoryExists = directoryExists;
  const program = ts.createProgram({ rootNames, options: parsed.options, host, projectReferences: parsed.projectReferences });
  const errors = ts.getPreEmitDiagnostics(program).filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
  results.push(errors.map(format));
}
process.stdout.write(JSON.stringify(results));
