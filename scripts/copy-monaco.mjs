// Copies Monaco's prebuilt editor (node_modules/monaco-editor/min/vs) to public/monaco/vs, so the /editor page
// loads it from this server rather than a CDN. Runs after `npm install`; skips the copy when it's already current.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "node_modules", "monaco-editor");
const target = path.join(root, "public", "monaco");
const marker = path.join(target, "VERSION");

const { version } = JSON.parse(fs.readFileSync(path.join(source, "package.json"), "utf8"));
if (fs.existsSync(marker) && fs.readFileSync(marker, "utf8") === version) process.exit(0);

fs.rmSync(target, { recursive: true, force: true });
fs.cpSync(path.join(source, "min", "vs"), path.join(target, "vs"), { recursive: true });
fs.writeFileSync(marker, version);
console.log(`Copied Monaco ${version} to public/monaco.`);
