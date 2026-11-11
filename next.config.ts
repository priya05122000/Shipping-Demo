import type { NextConfig } from "next";

/**
 * Where the ships' viewers are hosted, each at <SHIP_VIEWER_URL>/<ship>/. They're built and deployed separately from
 * this app (see child/README.md):
 *   development  the child's Vite dev server (`npm run dev:child`), which serves every ship under /child/
 *   production   any static host the built ships (child/dist/<ship>/) are uploaded to, e.g. https://ships.example.com,
 *                or http://localhost:4173/child for `npm run serve:ships`. Read when the app is built.
 */
const SHIP_VIEWER_URL = (process.env.SHIP_VIEWER_URL ?? (process.env.NODE_ENV === "development" ? "http://localhost:5173/child" : ""))
  .trim()
  .replace(/\/+$/, "");

if (!SHIP_VIEWER_URL) {
  console.warn("SHIP_VIEWER_URL isn't set, so ships' viewers can't be shown: set it to where the built ships are hosted.");
}

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // PDF.js (which reads uploaded manuals) loads its worker from a file next to itself, and the Claude Agent SDK (which
  // generates sections' React code) starts the Claude Code binary installed next to itself, so both run unbundled.
  serverExternalPackages: ["pdfjs-dist", "@anthropic-ai/claude-agent-sdk"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Each ship's viewer is served on this origin under /child/<ship>/, proxied to wherever it's hosted, so the viewer
  // and this app can talk with postMessage on one origin. Nothing from child/ is part of this app's build.
  // Its responses, caching headers included, are the ships' host's (see child/scripts/serve-ships.mjs).
  async rewrites() {
    if (!SHIP_VIEWER_URL) return [];
    return {
      beforeFiles: [{ source: "/child/:path*", destination: `${SHIP_VIEWER_URL}/:path*` }],
    };
  },
};

export default nextConfig;
