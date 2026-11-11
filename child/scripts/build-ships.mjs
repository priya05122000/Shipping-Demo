// Builds the ships in child/ships, each on its own as `npm run build` in its folder would (type-check, then Vite with
// its own vite.config.ts), into child/dist/<ship>/, using the child app's toolchain, so no ship needs its own
// `npm install` (from child/):
//   npm run build                     every ship (node scripts/build-ships.mjs)
//   npm run build -- <ship>...        only the named ships (their folder names in child/ships)
// Each dist/<ship>/ is a complete static site with relative URLs: deploy it on its own, to any static host. For Ship
// Docs (the parent), it goes at <SHIP_VIEWER_URL>/<ship>/ (see ../../next.config.ts); `npm run serve` serves them all
// locally. A ship that fails to build doesn't stop the others, and has no output; the exit code is 1 if any failed.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const childDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const shipsDir = path.join(childDir, "ships");
const distDir = path.join(childDir, "dist");
const tsc = createRequire(import.meta.url).resolve("typescript/bin/tsc");

const args = process.argv.slice(2);
const flags = args.filter((arg) => arg.startsWith("-"));
if (flags.length) fail(`Unknown option ${flags.join(", ")}. Name the ships to build, or none to build them all.`);
const named = args;

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

// Building every ship removes the output of ships that no longer exist, so they aren't deployed by mistake.
if (!named.length && fs.existsSync(distDir)) {
  for (const entry of fs.readdirSync(distDir)) {
    if (!allShips.includes(entry)) fs.rmSync(path.join(distDir, entry), { recursive: true, force: true });
  }
}

const built = [];
const failed = [];
for (const ship of ships) {
  const root = path.join(shipsDir, ship);
  const outDir = path.join(distDir, ship);
  console.log(`\nShip: ${ship}`);
  // A failed build leaves nothing behind, so an older build of the ship can't be deployed as if it were new.
  fs.rmSync(outDir, { recursive: true, force: true });
  try {
    execFileSync(process.execPath, [tsc, "-b", root], { stdio: "inherit" });
    await build({
      root,
      configFile: path.join(root, "vite.config.ts"),
      build: { outDir, emptyOutDir: true },
    });
    built.push(ship);
  } catch (error) {
    fs.rmSync(outDir, { recursive: true, force: true });
    failed.push(ship);
    // tsc already printed its errors; Vite's are in the error.
    if (!(error && typeof error === "object" && "status" in error)) console.error(error instanceof Error ? error.message : error);
  }
}

const plural = (count) => `${count} ship${count === 1 ? "" : "s"}`;
if (built.length) {
  console.log(`\nBuilt ${plural(built.length)}, each a static site to deploy on its own:`);
  for (const ship of built) console.log(`  ${ship}: child/dist/${ship}/`);
}
if (failed.length) {
  console.error(`\n${plural(failed.length)} failed to build: ${failed.join(", ")}.`);
  process.exit(1);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
