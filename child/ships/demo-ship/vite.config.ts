import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * One ship's viewer, a standalone project: `npm install`, then `npm run dev`, or `npm run build` for a static site in
 * dist/ that can be hosted at any path. Inside Ship Docs, every ship is served by ../../vite.config.ts instead.
 */
export default defineConfig({
  // Relative URLs, so the build works wherever it's hosted (and inside Ship Docs, under /child/<ship>/).
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  // 3D models are imported as `?url`; as known asset types they also import as URLs behind a proxy that rewrites
  // the query to `?url=` (as Ship Docs' dev server does). Images and PDFs already are.
  assetsInclude: ["**/*.glb", "**/*.gltf", "**/*.obj", "**/*.fbx", "**/*.stl", "**/*.blend"],
  build: {
    // Manuals and 3D models stay files, however small: browsers won't show a data: URL PDF in an iframe.
    assetsInlineLimit: (filePath) => (/\.(pdf|glb|gltf|obj|fbx|stl|blend)$/i.test(filePath) ? false : undefined),
  },
});
