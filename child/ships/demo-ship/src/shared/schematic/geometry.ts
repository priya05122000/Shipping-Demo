import { findObject, objectPort, type ObjectBox } from "@shipdocs/viewer-core/objects";
import type { Equipment, Pipe, PipeEnd, Point, Rotation, Schematic } from "./types";

/*
 * Where things are: ports, Library object boxes, pipe routes and what connects to what. Shared by the 2D and 3D views
 * (no React, no three.js), so both draw the same geometry.
 */

/** Rotates `p` (relative to the origin) clockwise by `rotation` degrees, in drawing coordinates (y down). */
export function rotate(p: Point, rotation: Rotation): Point {
  switch (rotation) {
    case 90:
      return [-p[1], p[0]];
    case 180:
      return [-p[0], -p[1]];
    case 270:
      return [p[1], -p[0]];
    default:
      return p;
  }
}

function placeLocal(item: Equipment, local: Point): Point {
  const [dx, dy] = rotate(local, item.rotation);
  return [item.at[0] + dx, item.at[1] + dy];
}

/**
 * The part of a Library object's 2D image that holds its symbol, as fractions of the image. The Library's images are
 * framed panels with a photo beside the symbol; the 2D views show only this part. Measured from each image.
 */
export const LIBRARY_SYMBOL_AREA: Record<string, { x0: number; y0: number; x1: number; y1: number }> = {
  "OBJ-003": { x0: 0.13, y0: 0.21, x1: 0.315, y1: 0.82 },
  "OBJ-004": { x0: 0.095, y0: 0.25, x1: 0.385, y1: 0.74 },
  "OBJ-005": { x0: 0.14, y0: 0.29, x1: 0.355, y1: 0.75 },
  "OBJ-006": { x0: 0.15, y0: 0.29, x1: 0.355, y1: 0.69 },
  "OBJ-007": { x0: 0.135, y0: 0.29, x1: 0.355, y1: 0.7 },
  "OBJ-008": { x0: 0.175, y0: 0.3, x1: 0.335, y1: 0.69 },
  "OBJ-009": { x0: 0.15, y0: 0.33, x1: 0.345, y1: 0.71 },
};

const WHOLE_IMAGE = { x0: 0, y0: 0, x1: 1, y1: 1 };

/**
 * The unrotated box ObjectSymbol2D draws a Library object in, keeping the image's aspect (its card's): scaled so its
 * "in" and "out" ports are `size` apart and centred on the item, or, without a card, so its symbol area is `size` wide.
 * `clip` is the symbol area in the same coordinates.
 */
export function libraryBox(item: Equipment, objectId: string): { box: ObjectBox; clip: ObjectBox } {
  const card = findObject(objectId)?.card ?? null;
  const area = LIBRARY_SYMBOL_AREA[objectId] ?? WHOLE_IMAGE;
  const aspect = card?.aspect ?? 3;
  const inlet = card?.ports.find((port) => port.id === "in");
  const outlet = card?.ports.find((port) => port.id === "out");
  const span = inlet && outlet ? Math.abs(outlet.x - inlet.x) : 0;
  let width: number;
  let anchor: Point;
  if (inlet && outlet && span > 0) {
    width = item.size / span;
    anchor = [(inlet.x + outlet.x) / 2, (inlet.y + outlet.y) / 2];
  } else {
    width = item.size / (area.x1 - area.x0);
    anchor = [(area.x0 + area.x1) / 2, (area.y0 + area.y1) / 2];
  }
  const height = width / aspect;
  const box = { x: item.at[0] - anchor[0] * width, y: item.at[1] - anchor[1] * height, width, height };
  const clip = {
    x: box.x + area.x0 * width,
    y: box.y + area.y0 * height,
    width: (area.x1 - area.x0) * width,
    height: (area.y1 - area.y0) * height,
  };
  return { box, clip };
}

/** Ports of the shared symbols, unrotated, relative to the item's centre. */
function genericPorts(item: Equipment): Record<string, Point> {
  const h = item.size / 2;
  switch (item.kind) {
    case "tank":
      return { n: [0, -h], s: [0, h], e: [h, 0], w: [-h, 0] };
    case "angle-valve":
      return { in: [-h, 0], out: [0, -h] };
    case "gauge":
      return { in: [-h, 0] };
    case "end-flange":
      return { p: [0, item.size * 0.15] };
    case "open-end":
      return { p: [0, h] };
    case "valve":
      return item.variant === "blind" ? { in: [-h, 0] } : { in: [-h, 0], out: [h, 0] };
    default:
      return { in: [-h, 0], out: [h, 0] };
  }
}

/** Where a pipe joins `item` at `portId`, in drawing pixels. The item's centre for an unknown port. */
export function portPoint(item: Equipment, portId: string): Point {
  if (item.object) {
    const { box } = libraryBox(item, item.object);
    const p = objectPort(item.object, portId, box);
    return placeLocal(item, [p.x - item.at[0], p.y - item.at[1]]);
  }
  const local = genericPorts(item)[portId];
  return local ? placeLocal(item, local) : item.at;
}

/** Lookups for one schematic, made once per schematic. */
export interface SchematicIndex {
  schematic: Schematic;
  equipment: Map<string, Equipment>;
  junctions: Map<string, Point>;
  /** Equipment by the key the views select it by (tag, or instance ID). */
  byKey: Map<string, Equipment>;
}

export function indexSchematic(schematic: Schematic): SchematicIndex {
  return {
    schematic,
    equipment: new Map(schematic.equipment.map((item) => [item.id, item])),
    junctions: new Map(schematic.junctions.map((junction) => [junction.id, junction.at])),
    byKey: new Map(schematic.equipment.map((item) => [item.tag ?? item.id, item])),
  };
}

function endPoint(index: SchematicIndex, end: PipeEnd): Point {
  if ("open" in end) return end.open;
  const item = index.equipment.get(end.item);
  if (item) return end.port ? portPoint(item, end.port) : item.at;
  return index.junctions.get(end.item) ?? [0, 0];
}

/** A pipe's route from end to end, in drawing pixels. */
export function pipeRoute(index: SchematicIndex, pipe: Pipe): Point[] {
  return [endPoint(index, pipe.from), ...(pipe.via ?? []), endPoint(index, pipe.to)];
}

/**
 * What is joined to an item through pipes: the pipes leading from it (followed through junctions) and the equipment
 * at their far ends. Pipes that only cross are never followed.
 */
export function connectionsOf(index: SchematicIndex, itemId: string): { pipes: Set<string>; items: Set<string> } {
  const pipes = new Set<string>();
  const items = new Set<string>();
  const visitedJunctions = new Set<string>();
  const queue: string[] = [itemId];
  while (queue.length > 0) {
    const node = queue.shift() as string;
    for (const pipe of index.schematic.pipes) {
      if (pipes.has(pipe.id)) continue;
      const ends = [pipe.from, pipe.to];
      if (!ends.some((end) => "item" in end && end.item === node)) continue;
      pipes.add(pipe.id);
      for (const end of ends) {
        if (!("item" in end) || end.item === node) continue;
        if (index.equipment.has(end.item)) items.add(end.item);
        else if (index.junctions.has(end.item) && !visitedJunctions.has(end.item)) {
          visitedJunctions.add(end.item);
          queue.push(end.item);
        }
      }
    }
  }
  items.delete(itemId);
  return { pipes, items };
}

/** Pipe thickness for the views, from the nominal bore on the drawing (visual only). */
export function pipeWeight(bore: number | undefined): number {
  if (!bore) return 1;
  if (bore >= 150) return 1.5;
  if (bore >= 100) return 1.2;
  return 0.9;
}
