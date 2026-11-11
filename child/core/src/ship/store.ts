import { useSyncExternalStore } from "react";
import type { ShipCustomization, ShipInfo } from "../customize/types";
import type { ShipManifest } from "./manifest";
import { buildObjects, type SharedObject } from "../objects/registry";
import type { Section } from "../sections";
import { buildSections } from "../sections/registry";
import { applyTheme, DEFAULT_ACCENT } from "../theme";

export type { ShipInfo };

/** Everything the viewer shows, read from one ship's manifest (see manifest.ts): layers 2 and 3 (see ../customize/types.ts). */
export interface LoadedShip {
  ship: ShipInfo;
  /** Every drawing the viewer offers, in menu order (oldest first, as in the Library, unless the ship orders them). */
  sections: Section[];
  /** Every shared object, oldest first. */
  objects: SharedObject[];
  /** The ship's customizations (its src/custom/), or none. */
  customization: ShipCustomization;
}

let current: LoadedShip | null = null;
const listeners = new Set<() => void>();

function load(manifest: ShipManifest): LoadedShip {
  const objects = buildObjects(manifest.objects);
  // A ship has at most one src/custom/index.ts(x).
  const customization: ShipCustomization = Object.values(manifest.customization ?? {})[0] ?? {};
  const all = buildSections(manifest.sections, objects);
  let sections = all;
  try {
    sections = customization.hooks?.sections?.(all) ?? all;
  } catch (error) {
    console.error("This ship's sections hook failed, so every section is shown:", error);
  }
  return {
    ship: { id: manifest.ship.id ?? "", name: manifest.ship.name ?? "Ship" },
    sections,
    objects,
    customization,
  };
}

/**
 * Sets the ship the viewer shows: by mountShip() at startup, and again when a dev hot update changes the ship's data
 * or customizations, which re-renders the viewer and keeps its state.
 */
export function setShip(manifest: ShipManifest) {
  current = load(manifest);
  applyTheme(current.customization.theme);
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

/** The accent colour as a CSS colour, for what can't use the CSS variables (e.g. three.js materials). */
export function accentColor(): string {
  return current?.customization.theme?.accent ?? DEFAULT_ACCENT;
}
