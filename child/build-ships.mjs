// Builds the ships in ./ships, each as `npm run build` in its folder would (type-check, then Vite with its own
// vite.config.ts), using this folder's toolchain, so no ship needs its own `npm install`:
//   node build-ships.mjs                     every ship into ../public/child/<ship>/, which Next serves as static files
//   node build-ships.mjs --standalone        every ship into its own ships/<ship>/dist/, a static site to host on its own
//   node build-ships.mjs [--standalone] <ship>...    only the named ships (their folder names in ./ships)
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const here = path.dirname(fileURLToPath(import.meta.url));
const shipsDir = path.join(here, "ships");
const publicDir = path.join(here, "..", "public", "child");
const tsc = createRequire(import.meta.url).resolve("typescript/bin/tsc");

const args = process.argv.slice(2);
const flags = args.filter((arg) => arg.startsWith("-"));
const named = args.filter((arg) => !arg.startsWith("-"));
const unknownFlags = flags.filter((flag) => flag !== "--standalone");
if (unknownFlags.length) fail(`Unknown option ${unknownFlags.join(", ")}. The only option is --standalone.`);
const standalone = flags.includes("--standalone");

// A ship folder is listed once its ship.json is written (see src/server/storage.ts in the parent).
const allShips = fs
  .readdirSync(shipsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(shipsDir, entry.name, "ship.json")))
  .map((entry) => entry.name);

const unknownShips = named.filter((name) => !allShips.includes(name));
if (unknownShips.length) {
  fail(`No ship named ${unknownShips.join(", ")} in child/ships. The ships are: ${allShips.join(", ") || "none"}.`);
}
const ships = named.length ? [...new Set(named)] : allShips;

// Building every ship for Next starts clean, so deleted ships don't linger in the build.
if (!standalone && !named.length) fs.rmSync(publicDir, { recursive: true, force: true });

const built = [];
for (const ship of ships) {
  const root = path.join(shipsDir, ship);
  const outDir = standalone ? path.join(root, "dist") : path.join(publicDir, ship);
  console.log(`\nShip: ${ship}`);
  execFileSync(process.execPath, [tsc, "-b", root], { stdio: "inherit" });
  await build({
    root,
    configFile: path.join(root, "vite.config.ts"),
    build: { outDir, emptyOutDir: true },
  });
  built.push({ ship, outDir });
}

const count = `${built.length} ship${built.length === 1 ? "" : "s"}`;
if (standalone) {
  console.log(`\nBuilt ${count}, each a static site to host on its own (upload the folder's contents):`);
  for (const { ship, outDir } of built) console.log(`  ${ship}: ${path.relative(path.join(here, ".."), outDir)}`);
} else {
  console.log(`\nBuilt ${count} into public/child.`);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
