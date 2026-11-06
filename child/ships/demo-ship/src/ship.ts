import json from "../ship.json";

/** Shape of this project's ship.json, as written by the Library (the parent app). Only the fields the viewer uses. */
interface ShipMeta {
  /** Unique, e.g. "SHP-001". The parent checks it when it embeds the viewer. */
  id?: string;
  name?: string;
}

const meta: ShipMeta = json;

/** The ship this project shows. ship.json is rewritten by the Library when the ship is renamed. */
export const ship = {
  id: meta.id ?? "",
  name: meta.name ?? "Ship",
};
