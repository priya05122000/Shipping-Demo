// "@shipdocs/viewer-core/client": the types a ship's src needs, referenced from its src/env.d.ts. Vite's own (import.meta.glob,
// asset imports), and the ship's manifest, which the shipViewer() plugin (vite.js) writes for each ship.
/// <reference types="vite/client" />

declare module "virtual:ship-manifest" {
  const manifest: import("./src/ship/manifest").ShipManifest;
  export default manifest;
}
