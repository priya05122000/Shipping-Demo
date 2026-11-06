import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const SHIPS_DIR = fileURLToPath(new URL("./ships", import.meta.url));

/**
 * Development server for every ship at once. Each folder in ./ships is a standalone Vite project (made from
 * ./template), served here at /child/<ship>/, so a ship added in the Library works without starting anything:
 *   dev   Next rewrites /child/* to this server (see ../next.config.ts)
 *   build each ship is built on its own, with its own vite.config.ts (see build-ships.mjs)
 */
export default defineConfig({
  root: SHIPS_DIR,
  base: "/child/",
  // Every ship is its own page; there's no app at the root.
  appType: "mpa",
  // No shared public folder: each ship keeps its files in its own src.
  publicDir: false,
  plugins: [shipAlias(), react(), tailwindcss()],
  // As in each ship's own config: 3D models imported as `?url` reach Vite as `?url=` through Next's proxy, a query
  // Vite doesn't recognize, so they need to be known asset types (images and PDFs already are).
  assetsInclude: ["**/*.glb", "**/*.gltf", "**/*.obj", "**/*.fbx", "**/*.stl", "**/*.blend"],
  optimizeDeps: { entries: ["*/index.html"] },
  server: {
    port: 5173,
    strictPort: true,
    // Connect HMR straight to Vite: Next redirects the trailing slash in "/child/" and drops redirected websocket upgrades.
    hmr: { clientPort: 5173 },
  },
});

/** Resolves "@/…" to the importing ship's own src folder, as each ship's vite.config.ts does when run on its own. */
function shipAlias(): Plugin {
  return {
    name: "ship-alias",
    enforce: "pre",
    resolveId(source, importer, options) {
      if (!source.startsWith("@/") || !importer) return null;
      const [ship] = path.relative(SHIPS_DIR, importer.replace(/\?.*$/, "")).split(/[\\/]/);
      if (!ship || ship === ".." || path.isAbsolute(ship)) return null;
      return this.resolve(path.join(SHIPS_DIR, ship, "src", source.slice(2)), importer, { ...options, skipSelf: true });
    },
  };
}
