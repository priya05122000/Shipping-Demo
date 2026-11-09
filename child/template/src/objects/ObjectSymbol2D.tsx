import { findObject, type ObjectBox } from "./objects";

export interface ObjectSymbol2DProps extends ObjectBox {
  /** The object's ID, e.g. "OBJ-001". */
  id: string;
  /** Draws a selection outline around it. */
  selected?: boolean;
}

/**
 * An object from the Library in a 2D (SVG) view: its line diagram image, stretched to the box, so give the box the
 * object's aspect ratio (its card's `aspect`, width ÷ height). A dashed placeholder while it has no image. Render it
 * inside an <svg>. It isn't clickable by itself: put it in the item's clickable group, and draw pipes to the points
 * objectPort gives for the same box.
 */
export function ObjectSymbol2D({ id, x, y, width, height, selected = false }: ObjectSymbol2DProps) {
  const image = findObject(id)?.lineDiagram;
  return (
    <g>
      {image ? (
        <image href={image} x={x} y={y} width={width} height={height} preserveAspectRatio="none" />
      ) : (
        <rect x={x} y={y} width={width} height={height} rx={4} fill="#f8fafc" stroke="#94a3b8" strokeDasharray="4 3" />
      )}
      {selected && (
        <rect x={x - 4} y={y - 4} width={width + 8} height={height + 8} rx={6} fill="none" stroke="#4f46e5" strokeWidth={2} />
      )}
    </g>
  );
}
