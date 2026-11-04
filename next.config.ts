import type { NextConfig } from "next";

/** Vite dev server for the viewer app in ./child (see child/vite.config.ts). */
const CHILD_DEV_URL = process.env.CHILD_DEV_URL ?? "http://localhost:5173";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // The child is served under /child. In production it's static files in public/child (built by
  // `npm run build -w child`). In development it's proxied to Vite; beforeFiles so a stale build can't shadow it.
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
        source: "/child/assets/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
