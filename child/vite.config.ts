import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * The child is served under /child by the Next.js parent:
 *   dev   Next rewrites /child/* to this dev server (see ../next.config.ts)
 *   build output goes to ../public/child, which Next serves as static files
 */
export default defineConfig({
  base: "/child/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    port: 5173,
    strictPort: true,
    // Connect HMR straight to Vite: Next redirects the trailing slash in "/child/" and drops redirected websocket upgrades.
    hmr: { clientPort: 5173 },
  },
  build: {
    outDir: "../public/child",
    emptyOutDir: true,
    // Manuals and 3D models stay files, however small: browsers won't show a data: URL PDF in an iframe.
    assetsInlineLimit: (filePath) => (/\.(pdf|glb|gltf|obj|fbx|stl|blend)$/i.test(filePath) ? false : undefined),
  },
});
