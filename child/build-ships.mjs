// Builds every ship in ./ships for the parent, each as `npm run build` in its folder would (type-check, then Vite
// with its own vite.config.ts), but into ../public/child/<ship>/, which Next serves as static files.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const here = path.dirname(fileURLToPath(import.meta.url));
const shipsDir = path.join(here, "ships");
const outDir = path.join(here, "..", "public", "child");
const tsc = createRequire(import.meta.url).resolve("typescript/bin/tsc");

// A ship folder is listed once its ship.json is written (see src/server/storage.ts in the parent).
const ships = fs
  .readdirSync(shipsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(shipsDir, entry.name, "ship.json")))
  .map((entry) => entry.name);

// Start clean, so deleted ships don't linger in the build.
fs.rmSync(outDir, { recursive: true, force: true });
for (const ship of ships) {
  const root = path.join(shipsDir, ship);
  console.log(`\nShip: ${ship}`);
  execFileSync(process.execPath, [tsc, "-b", root], { stdio: "inherit" });
  await build({
    root,
    configFile: path.join(root, "vite.config.ts"),
    build: { outDir: path.join(outDir, ship), emptyOutDir: true },
  });
}
console.log(`\nBuilt ${ships.length} ship${ships.length === 1 ? "" : "s"} into public/child.`);
