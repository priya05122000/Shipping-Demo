/** Formats a sequence number as a padded record ID, e.g. ("OBJ", 7) -> "OBJ-007". */
export function formatId(prefix: string, seq: number): string {
  return `${prefix}-${String(seq).padStart(3, "0")}`;
}

/** Extracts the sequence number from an ID with the given prefix, or null if it doesn't match. */
export function parseSeq(prefix: string, id: string): number | null {
  const match = new RegExp(`^${prefix}-(\\d+)$`).exec(id);
  return match ? Number(match[1]) : null;
}

export const SLUG_MAX = 60;
/** A folder name made by slugify(): lower-case letters and digits, joined by single hyphens. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Folder name for a name, e.g. "Engine Room (Aft)" -> "engine-room-aft". Empty if the name has no letters or digits. */
export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // accents: "é" -> "e"
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/, "");
}
