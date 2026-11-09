/**
 * An object's card: what Ship Docs' code generation learned from the object's line diagram image the first time a
 * section's code used the object, kept as card.json in the object's folder. Later generations place the object from
 * its card, without looking at the image again. A card belongs to one image (`image`): once the image is replaced in
 * the Library, the card is ignored until a generation looks at the new one.
 * Connection points are fractions of the image as ObjectSymbol2D draws it (stretched to its box): x from the left
 * edge, y from the top, each from 0 to 1.
 */

export interface ObjectCardPort {
  /** Unique within the card, e.g. "in", "out", "drain". */
  id: string;
  x: number;
  y: number;
}

export interface ObjectCard {
  /** Stored name of the image the card was made from, e.g. "lineDiagram-9f2c1a7b.png". */
  image: string;
  /** Kind of equipment, e.g. "gate valve", "tank", "pipe joint". */
  kind: string;
  /** What the symbol looks like, in a sentence or two. */
  description: string;
  /** Width ÷ height of the image. */
  aspect: number;
  /** Where pipes connect. */
  ports: ObjectCardPort[];
}

const PORT_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,23}$/;

function isFraction(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

/**
 * A card.json's content, checked (it can be edited by hand), or null if it isn't usable or was made from another
 * image than `image` (the object's current one).
 */
export function readCard(value: unknown, image: string | undefined): ObjectCard | null {
  if (!image || !value || typeof value !== "object" || Array.isArray(value)) return null;
  const card = value as Record<string, unknown>;
  if (card.image !== image || typeof card.kind !== "string" || typeof card.description !== "string") return null;
  if (typeof card.aspect !== "number" || !Number.isFinite(card.aspect) || card.aspect <= 0) return null;
  if (!Array.isArray(card.ports)) return null;
  const ports: ObjectCardPort[] = [];
  for (const port of card.ports as unknown[]) {
    if (!port || typeof port !== "object") continue;
    const { id, x, y } = port as Record<string, unknown>;
    if (typeof id === "string" && PORT_ID.test(id) && isFraction(x) && isFraction(y)) ports.push({ id, x, y });
  }
  return { image, kind: card.kind, description: card.description, aspect: card.aspect, ports };
}
