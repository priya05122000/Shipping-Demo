import { fileURLToPath } from "node:url";
import { MODEL_ASSETS, shipViewer } from "@shipdocs/viewer-core/vite";
import { defineConfig } from "vite";

const SHIPS_DIR = fileURLToPath(new URL("./ships", import.meta.url));
/** 5173 unless CHILD_DEV_PORT says otherwise; Ship Docs then needs SHIP_VIEWER_URL=http://localhost:<port>/child. */
const PORT = Number(process.env.CHILD_DEV_PORT ?? 5173);

/**
 * Development server for every ship at once. Each folder in ./ships is a ship's project (made from ./template), served
 * here at /child/<ship>/, so a ship added in the Library works without starting anything. Every ship runs the viewer in
 * ./core (@shipdocs/viewer-core), so editing it updates every ship at once.
 *   dev   Ship Docs (the parent) proxies /child/* to this server (see ../next.config.ts)
 *   build each ship is built on its own, with its own vite.config.ts, into ./dist/<ship>/ (see scripts/build-ships.mjs)
 */
export default defineConfig({
  root: SHIPS_DIR,
  base: "/child/",
  // Every ship is its own page; there's no app at the root.
  appType: "mpa",
  // No shared public folder: each ship keeps its files in its own src.
  publicDir: false,
  // shipViewer() finds each ship's data and "@/" imports from the importing file, so each page gets its own ship.
  plugins: [shipViewer()],
  // As in each ship's own config: 3D models imported as `?url` reach Vite as `?url=` through Next's proxy, a query
  // Vite doesn't recognize, so they need to be known asset types (images and PDFs already are).
  assetsInclude: MODEL_ASSETS,
  optimizeDeps: {
    entries: ["*/index.html"],
    // Sections' generated 3D views (src/sections/*/Diagram3D.tsx) are loaded lazily, and can appear while the server
    // runs; pre-bundling their libraries up front keeps Vite from reloading the page when the first one is opened.
    include: ["three", "@react-three/fiber", "@react-three/drei"],
  },
  server: {
    port: PORT,
    strictPort: true,
    // Connect HMR straight to Vite: Next redirects the trailing slash in "/child/" and drops redirected websocket upgrades.
    hmr: { clientPort: PORT },
  },
});
