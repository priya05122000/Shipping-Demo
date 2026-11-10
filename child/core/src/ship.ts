import { useSyncExternalStore } from "react";
import type { ShipManifest } from "./manifest";
import { buildObjects, type SharedObject } from "./objects/registry";
import { buildSections } from "./sections/registry";
import type { Section } from "./shared/diagram";

/** The ship the viewer shows, from its ship.json. ship.json is rewritten by the Library when the ship is renamed. */
export interface ShipInfo {
  /** Unique, e.g. "SHP-001". The parent checks it when it embeds the viewer. */
  id: string;
  name: string;
}

/** Everything the viewer shows, read from one ship's manifest (see manifest.ts). */
export interface LoadedShip {
  ship: ShipInfo;
  /** Every drawing, in menu order (oldest first, as in the Library). */
  sections: Section[];
  /** Every shared object, oldest first. */
  objects: SharedObject[];
}

let current: LoadedShip | null = null;
const listeners = new Set<() => void>();

function load(manifest: ShipManifest): LoadedShip {
  const objects = buildObjects(manifest.objects);
  return {
    ship: { id: manifest.ship.id ?? "", name: manifest.ship.name ?? "Ship" },
    sections: buildSections(manifest.sections, objects),
    objects,
  };
}

/**
 * Sets the ship the viewer shows: by mountShip() at startup, and again when a dev hot update changes the ship's data
 * (a section or object added, changed or removed), which re-renders the viewer and keeps its state.
 */
export function setShip(manifest: ShipManifest) {
  current = load(manifest);
  for (const listener of listeners) listener();
}

/** The ship the viewer shows. Throws before mountShip() has run. */
export function getShip(): LoadedShip {
  if (!current) throw new Error("No ship is loaded: a ship's src/main.tsx calls mountShip() with its manifest first.");
  return current;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The ship the viewer shows, re-rendering when a hot update changes it. */
export function useShip(): LoadedShip {
  return useSyncExternalStore(subscribe, getShip);
}

export function findSection(id: string): Section | undefined {
  return getShip().sections.find((section) => section.id === id);
}

export function findObject(id: string): SharedObject | undefined {
  return getShip().objects.find((object) => object.id === id);
}
