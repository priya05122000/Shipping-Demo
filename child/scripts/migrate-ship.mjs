// Turns ships made before the shared viewer (child/core, @shipdocs/viewer-core) into thin ships. Back then each ship
// had its own copy of the viewer's code, copied from child/template when it was created; now every ship imports the
// one in child/core, so a change there reaches every ship.
//   node scripts/migrate-ship.mjs [--dry-run] [<ship>...]     every ship in ./ships, or only the named ones
// For each ship that still has its own copy of the viewer:
//   - removes that copy (src/app, src/shared/* but schematic, the src/objects and src/sections registries, src/ship.ts)
//   - writes the project's files from the template (vite.config.ts, tsconfig*.json, index.html, src/main.tsx…), and
//     the template's package.json with the ship's own name
//   - in the ship's own code (src/, and the versions in codegen/), points imports of what moved at the package:
//     "@/shared/diagram" -> "@shipdocs/viewer-core/diagram", "@/objects" -> "@shipdocs/viewer-core/objects"…
// The ship's data (ship.json, sections, objects), src/shared/schematic and codegen/ stay. Run it on a clean Git tree,
// so `git diff` shows what changed: a ship whose copy of the viewer was changed by hand loses those changes, which
// then belong in child/core.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const childDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const shipsDir = path.join(childDir, "ships");
const templateDir = path.join(childDir, "template");

/** What ships used to have their own copies of, now in @shipdocs/viewer-core. Relative to the ship's folder. */
const LEGACY = [
  "src/app",
  "src/ship.ts",
  "src/sections/index.ts",
  "src/objects/index.ts",
  "src/objects/objects.ts",
  "src/objects/card.ts",
  "src/objects/ObjectSymbol2D.tsx",
  "src/objects/ObjectModel3D.tsx",
  ...["assets", "catalog", "components", "data", "diagram", "manual", "operations", "records", "ui", "view2d", "view3d"].map(
    (name) => `src/shared/${name}`,
  ),
];
/** A ship has its own copy of the viewer if it has any of these. */
const LEGACY_MARKERS = ["src/app/App.tsx", "src/sections/index.ts", "src/ship.ts"];
/** The project's files, as the template has them. */
const FROM_TEMPLATE = [
  "index.html",
  "vite.config.ts",
  "tsconfig.json",
  "tsconfig.app.json",
  "tsconfig.node.json",
  ".gitignore",
  "README.md",
  "src/main.tsx",
  "src/styles.css",
  "src/env.d.ts",
];
/** Imports of what moved into the package, longest first. */
const IMPORTS = [
  ["@/objects/ObjectModel3D", "@shipdocs/viewer-core/objects/model3d"],
  ["@/shared/diagram", "@shipdocs/viewer-core/diagram"],
  ["@/shared/catalog", "@shipdocs/viewer-core/catalog"],
  ["@/shared/data", "@shipdocs/viewer-core/data"],
  ["@/shared/ui", "@shipdocs/viewer-core/ui"],
  ["@/objects", "@shipdocs/viewer-core/objects"],
];
/** Other imports of the old copy, which have no counterpart in the package: reported, to fix by hand. */
const UNMAPPED = /(["'])@\/(app|ship|sections|shared\/(?!schematic)[^"']*)\1/g;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const unknown = args.filter((arg) => arg.startsWith("-") && arg !== "--dry-run");
if (unknown.length) fail(`Unknown option ${unknown.join(", ")}. The only option is --dry-run.`);
const named = args.filter((arg) => !arg.startsWith("-"));

const allShips = fs
  .readdirSync(shipsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(shipsDir, entry.name, "ship.json")))
  .map((entry) => entry.name);
const missing = named.filter((name) => !allShips.includes(name));
if (missing.length) fail(`No ship named ${missing.join(", ")} in child/ships. The ships are: ${allShips.join(", ") || "none"}.`);

const exists = (file) => fs.existsSync(file);
const log = (message) => console.log(`${dryRun ? "[dry run] " : ""}${message}`);

function codeFiles(dir) {
  if (!exists(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : codeFiles(full);
    return entry.isFile() && /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

function rewriteImports(source) {
  let result = source;
  for (const [from, to] of IMPORTS) {
    const escaped = from.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
    result = result.replace(new RegExp(`(["'])${escaped}\\1`, "g"), (_, quote) => `${quote}${to}${quote}`);
  }
  return result;
}

let migrated = 0;
for (const ship of named.length ? [...new Set(named)] : allShips) {
  const dir = path.join(shipsDir, ship);
  if (!LEGACY_MARKERS.some((file) => exists(path.join(dir, file)))) {
    console.log(`${ship}: already uses @shipdocs/viewer-core.`);
    continue;
  }
  log(`${ship}:`);

  for (const rel of LEGACY) {
    const target = path.join(dir, rel);
    if (!exists(target)) continue;
    log(`  remove   ${rel}`);
    if (!dryRun) fs.rmSync(target, { recursive: true, force: true });
  }

  for (const rel of FROM_TEMPLATE) {
    const source = path.join(templateDir, rel);
    if (!exists(source)) continue;
    log(`  write    ${rel}`);
    if (!dryRun) {
      fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
      fs.copyFileSync(source, path.join(dir, rel));
    }
  }
  const pkg = JSON.parse(fs.readFileSync(path.join(templateDir, "package.json"), "utf8"));
  const own = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
  pkg.name = own.name ?? `ship-${ship}`;
  log("  write    package.json");
  if (!dryRun) fs.writeFileSync(path.join(dir, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`);

  for (const file of [...codeFiles(path.join(dir, "src")), ...codeFiles(path.join(dir, "codegen"))]) {
    const rel = path.relative(dir, file).split(path.sep).join("/");
    // The old copy itself (still there in a dry run).
    if (LEGACY.some((legacy) => rel === legacy || rel.startsWith(`${legacy}/`))) continue;
    const before = fs.readFileSync(file, "utf8");
    const after = rewriteImports(before);
    if (after !== before) {
      log(`  imports  ${rel}`);
      if (!dryRun) fs.writeFileSync(file, after);
    }
    for (const [match] of after.matchAll(UNMAPPED)) console.warn(`  check    ${rel} imports ${match}, which is no longer in the ship: fix it by hand.`);
  }
  migrated++;
}

console.log(`\n${dryRun ? "Would migrate" : "Migrated"} ${migrated} ship${migrated === 1 ? "" : "s"}.`);

function fail(message) {
  console.error(message);
  process.exit(1);
}
