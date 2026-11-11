import { findObject } from "../ship/store";
import type { ObjectBox } from "./registry";

export { findObject };

/**
 * Where one of an object's connection points (from its card) is, for the object drawn in `box` by ObjectSymbol2D:
 * the point to draw a pipe to. The box's centre if the object has no card, or no point with that ID.
 */
export function objectPort(id: string, portId: string, box: ObjectBox): { x: number; y: number } {
  const port = findObject(id)?.card?.ports.find((point) => point.id === portId);
  return port
    ? { x: box.x + port.x * box.width, y: box.y + port.y * box.height }
    : { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
