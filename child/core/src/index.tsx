import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import type { ShipManifest } from "./manifest";
import logo from "./shared/assets/logo.svg";
import { setShip } from "./ship";

/** The viewer's icon in the browser tab, unless the ship's index.html sets its own. */
function addFavicon() {
  if (document.querySelector('link[rel~="icon"]')) return;
  const link = document.createElement("link");
  link.rel = "icon";
  link.type = "image/svg+xml";
  link.href = logo;
  document.head.append(link);
}

/**
 * @shipdocs/viewer-core: the ship viewer every ship runs. A ship's project only holds its data (ship.json, sections,
 * objects) and generated code; its src/main.tsx is
 *
 *   import manifest from "virtual:ship-manifest";
 *   import { mountShip } from "@shipdocs/viewer-core";
 *   import "./styles.css";
 *   mountShip(manifest);
 *
 * so a change here reaches every ship the next time it's built (or at once, in the dev server).
 */
export function mountShip(manifest: ShipManifest, container: HTMLElement | null = document.getElementById("root")) {
  if (!container) throw new Error("The ship viewer needs an element with id \"root\" to render into.");
  setShip(manifest);
  addFavicon();
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

export { setShip, useShip, type LoadedShip, type ShipInfo } from "./ship";
export type { ShipManifest, ShipMeta, SectionMeta, ObjectMeta, SectionFiles, ObjectFiles } from "./manifest";
