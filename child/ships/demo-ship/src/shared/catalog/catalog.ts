/** Kinds of equipment that can appear on a drawing. */
export type CatalogKind = "tank" | "filter" | "valve" | "pump";

export interface CatalogEntry {
  label: string;
  /** Hotspot and badge colour. */
  color: string;
}

export const CATALOG: Record<CatalogKind, CatalogEntry> = {
  tank: { label: "Tank", color: "#0284c7" },
  filter: { label: "Filter", color: "#0d9488" },
  valve: { label: "Valve", color: "#d97706" },
  pump: { label: "Pump", color: "#4f46e5" },
};
