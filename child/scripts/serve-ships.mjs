// Serves the built ships (child/dist, from `npm run build`) at http://localhost:4173/child/<ship>/, as any static host
// would: for trying a production build of Ship Docs on one machine, with SHIP_VIEWER_URL=http://localhost:4173/child.
//   npm run serve          (node scripts/serve-ships.mjs, from child/) PORT sets the port (4173 by default)
// A real host only needs to do the same: serve each dist/<ship>/ folder as plain files, and let the browser keep
// assets/ (their names carry a content hash) for good.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const distDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
const port = Number(process.env.PORT ?? 4173);
const BASE = "/child/";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
};

/** The file a request path names inside dist/, or null if it's outside it or isn't a file. */
function fileFor(pathname) {
  if (!pathname.startsWith(BASE)) return null;
  let rel;
  try {
    rel = decodeURIComponent(pathname.slice(BASE.length));
  } catch {
    return null;
  }
  if (rel === "" || rel.endsWith("/")) rel += "index.html";
  const file = path.resolve(distDir, rel);
  if (!file.startsWith(distDir + path.sep)) return null;
  const stat = fs.statSync(file, { throwIfNoEntry: false });
  if (stat?.isDirectory()) return fileFor(`${pathname}/`);
  return stat?.isFile() ? file : null;
}

http
  .createServer((req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { Allow: "GET, HEAD" }).end();
      return;
    }
    const { pathname } = new URL(req.url ?? "/", "http://localhost");
    const file = fileFor(pathname);
    if (!file) {
      res.writeHead(404, { "Content-Type": "text/plain" }).end("Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream",
      "Content-Length": fs.statSync(file).size,
      // Vite puts a content hash in every built asset's name, so they never change; pages are checked each time.
      "Cache-Control": /\/assets\//.test(pathname) ? "public, max-age=31536000, immutable" : "no-cache",
    });
    if (req.method === "HEAD") res.end();
    else fs.createReadStream(file).pipe(res);
  })
  .listen(port, () => console.log(`Serving the built ships (child/dist) at http://localhost:${port}${BASE}<ship>/`));
