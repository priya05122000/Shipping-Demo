// @ts-check
import fs from "node:fs";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { mergeConfig } from "vite";

/**
 * "@shipdocs/viewer-core/vite": how a ship's project is built and served. Every ship's vite.config.ts is
 * `export default defineShipConfig()`, and child/vite.config.ts serves every ship at once with shipViewer(), so a change
 * here reaches every ship too. Plain JavaScript (types in vite.d.ts), so Node loads it with a ship's vite.config.ts.
 */

/** 3D model formats an object's model can have. */
const MODEL_EXTENSIONS = ["glb", "gltf", "obj", "fbx", "stl", "blend"];

/**
 * 3D models are imported as `?url`; as known asset types they also import as URLs behind a proxy that rewrites the
 * query to `?url=` (as Ship Docs does in development). Images and PDFs already are.
 */
export const MODEL_ASSETS = MODEL_EXTENSIONS.map((extension) => `**/*.${extension}`);

/** What a ship's src/main.tsx imports its data from (see src/ship/manifest.ts). */
const MANIFEST_ID = "virtual:ship-manifest";
/** The manifest's module ID, one per ship: followed by the ship's folder relative to Vite's root, with "/". */
const MANIFEST_PREFIX = "\0ship-manifest:";
/** The file that makes a folder a ship's project, written by the Library. */
const SHIP_FILE = "ship.json";

/**
 * An importer's file path, without a query; null for a virtual module.
 * @param {string | undefined} importer
 * @returns {string | null}
 */
function fileOf(importer) {
  if (!importer || importer.startsWith("\0")) return null;
  return importer.replace(/\?.*$/, "");
}

/**
 * The ship's project folder a file is in: the nearest folder above it with a ship.json, or null.
 * @param {string} file
 * @returns {string | null}
 */
function shipFolderOf(file) {
  for (let dir = path.dirname(file); ; dir = path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, SHIP_FILE))) return dir;
    if (path.dirname(dir) === dir) return null;
  }
}

/**
 * The manifest of the ship in `folder` (relative to Vite's root, with "/"; "" when the root is the ship's folder).
 * Its globs are relative to the ship's own folders (the `base` option), so their keys are like "./engine-room/section.json".
 * On a hot update (a section, object or customization added, changed or removed) it gives the viewer the new data, which
 * keeps its state.
 * @param {string} folder
 */
function manifestModule(folder) {
  /** @param {string} file */
  const at = (file) => JSON.stringify(path.posix.join("/", folder, file));
  const sections = at("src/sections");
  const objects = at("src/objects");
  const custom = at("src/custom");
  return `import ship from ${at(SHIP_FILE)};
import { setShip } from "@shipdocs/viewer-core";

const manifest = {
  ship,
  sections: {
    metas: import.meta.glob("./*/section.json", { base: ${sections}, eager: true, import: "default" }),
    urls: import.meta.glob("./*/*.{png,jpg,jpeg,webp,svg,pdf}", { base: ${sections}, eager: true, query: "?url", import: "default" }),
    diagrams: import.meta.glob("./*/diagram.ts", { base: ${sections}, eager: true, import: "default" }),
    details: import.meta.glob("./*/data.json", { base: ${sections}, eager: true, import: "default" }),
    icons: import.meta.glob("./*/Icon.tsx", { base: ${sections}, eager: true, import: "default" }),
    manualData: import.meta.glob("./*/manual-data.json", { base: ${sections}, import: "default" }),
    views2d: import.meta.glob("./*/Diagram2D.tsx", { base: ${sections} }),
    views3d: import.meta.glob("./*/Diagram3D.tsx", { base: ${sections} }),
  },
  objects: {
    metas: import.meta.glob("./*/object.json", { base: ${objects}, eager: true, import: "default" }),
    urls: import.meta.glob("./*/*.{${MODEL_EXTENSIONS.join(",")},png,jpg,jpeg,webp,svg}", { base: ${objects}, eager: true, query: "?url", import: "default" }),
    cards: import.meta.glob("./*/card.json", { base: ${objects}, eager: true, import: "default" }),
  },
  // Layer 2: this ship's customizations, if it has any (see src/customize/types.ts).
  customization: import.meta.glob("./index.{ts,tsx}", { base: ${custom}, eager: true, import: "default" }),
};
export default manifest;

if (import.meta.hot) import.meta.hot.accept((next) => next && setShip(next.default));
`;
}

/**
 * "virtual:ship-manifest": the importing ship's data (see src/ship/manifest.ts).
 * @returns {import("vite").Plugin}
 */
function shipManifest() {
  let root = process.cwd();
  return {
    name: "shipdocs:ship-manifest",
    enforce: "pre",
    configResolved(config) {
      root = config.root;
    },
    resolveId(source, importer) {
      if (source !== MANIFEST_ID) return null;
      const file = fileOf(importer);
      const folder = file && shipFolderOf(file);
      if (!folder) return this.error(`${MANIFEST_ID} can only be imported from a ship's project (a folder with a ${SHIP_FILE}).`);
      const relative = path.relative(root, folder);
      if (relative.startsWith("..") || path.isAbsolute(relative)) {
        return this.error(`The ship's project ${folder} is outside Vite's root (${root}), so its files can't be found.`);
      }
      return MANIFEST_PREFIX + relative.split(path.sep).join("/");
    },
    load(id) {
      return id.startsWith(MANIFEST_PREFIX) ? manifestModule(id.slice(MANIFEST_PREFIX.length)) : null;
    },
  };
}

/**
 * Resolves "@/…" to the importing ship's own src folder, whichever ship it is (so one server can serve them all).
 * @returns {import("vite").Plugin}
 */
function shipAlias() {
  return {
    name: "shipdocs:ship-alias",
    enforce: "pre",
    resolveId(source, importer, options) {
      if (!source.startsWith("@/")) return null;
      const file = fileOf(importer);
      const folder = file && shipFolderOf(file);
      if (!folder) return null;
      return this.resolve(path.join(folder, "src", source.slice(2)), importer, { ...options, skipSelf: true });
    },
  };
}

/**
 * The plugins a ship's viewer needs: its data, its "@/" imports, React and Tailwind.
 * @returns {import("vite").PluginOption[]}
 */
export function shipViewer() {
  return [shipAlias(), shipManifest(), react(), tailwindcss()];
}

/**
 * The Vite config of one ship's project: `npm run dev`, or `npm run build` for a static site in dist/ with relative
 * URLs, which works wherever it's hosted (on its own, or behind Ship Docs under /child/<ship>/). `overrides` are
 * merged in.
 * @param {import("vite").UserConfig} [overrides]
 * @returns {import("vite").UserConfig}
 */
export function defineShipConfig(overrides = {}) {
  return mergeConfig(
    /** @type {import("vite").UserConfig} */ ({
      base: "./",
      plugins: [shipViewer()],
      assetsInclude: MODEL_ASSETS,
      build: {
        // Manuals and 3D models stay files, however small: browsers won't show a data: URL PDF in an iframe.
        assetsInlineLimit: (filePath) => (/\.(pdf|glb|gltf|obj|fbx|stl|blend)$/i.test(filePath) ? false : undefined),
        // A generated 3D view (src/sections/*/Diagram3D.tsx) is a lazily loaded chunk with three.js, about 1 MB.
        chunkSizeWarningLimit: 1500,
      },
    }),
    overrides,
  );
}
