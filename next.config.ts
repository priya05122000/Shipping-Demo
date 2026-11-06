import type { NextConfig } from "next";

/** Vite dev server for the ships' viewers in ./child/ships (see child/vite.config.ts). */
const CHILD_DEV_URL = process.env.CHILD_DEV_URL ?? "http://localhost:5173";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // PDF.js (which reads uploaded manuals) loads its worker from a file next to itself, so it's run from node_modules unbundled.
  serverExternalPackages: ["pdfjs-dist"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Each ship's viewer is served under /child/<ship>/. In production they're static files in public/child (built by
  // `npm run build -w child`). In development they're proxied to Vite; beforeFiles so a stale build can't shadow them.
  async rewrites() {
    if (process.env.NODE_ENV !== "development") return [];
    return {
      beforeFiles: [{ source: "/child/:path*", destination: `${CHILD_DEV_URL}/child/:path*` }],
    };
  },
  async headers() {
    // Vite puts a content hash in every built asset name, so they never change.
    return [
      {
        source: "/child/:ship/assets/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
