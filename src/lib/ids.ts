/** Formats a sequence number as a padded record ID, e.g. ("LD", 7) -> "LD-007". */
export function formatId(prefix: string, seq: number): string {
  return `${prefix}-${String(seq).padStart(3, "0")}`;
}

/** Extracts the sequence number from an ID with the given prefix, or null if it doesn't match. */
export function parseSeq(prefix: string, id: string): number | null {
  const match = new RegExp(`^${prefix}-(\\d+)$`).exec(id);
  return match ? Number(match[1]) : null;
}
