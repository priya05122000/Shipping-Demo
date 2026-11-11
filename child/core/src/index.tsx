import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import type { ShipManifest } from "./ship/manifest";
import defaultLogo from "./assets/logo.svg";
import { getShip, setShip } from "./ship/store";

/** The icon in the browser tab: the ship's logo (its theme's) or the viewer's, unless index.html sets its own. */
function addFavicon(href: string) {
  if (document.querySelector('link[rel~="icon"]')) return;
  const link = document.createElement("link");
  link.rel = "icon";
  link.href = href;
  document.head.append(link);
}

/**
 * @shipdocs/viewer-core: the ship viewer every ship runs (layer 1). A ship's project holds its customizations
 * (src/custom/, layer 2) and its content (ship.json, sections, objects and generated code, layer 3); its src/main.tsx is
 *
 *   import manifest from "virtual:ship-manifest";
 *   import { mountShip } from "@shipdocs/viewer-core";
 *   import "./styles.css";
 *   mountShip(manifest);
 *
 * so a change here reaches every ship the next time it's built (or at once, in the dev server), and a ship's
 * customizations reach that ship only. See customize/types.ts.
 */
export function mountShip(manifest: ShipManifest, container: HTMLElement | null = document.getElementById("root")) {
  if (!container) throw new Error("The ship viewer needs an element with id \"root\" to render into.");
  setShip(manifest);
  addFavicon(getShip().customization.theme?.logo ?? defaultLogo);
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

export { setShip, useShip, type LoadedShip, type ShipInfo } from "./ship/store";
export type { ShipManifest, ShipMeta, SectionMeta, ObjectMeta, SectionFiles, ObjectFiles } from "./ship/manifest";
export type { ShipCustomization } from "./customize/types";
