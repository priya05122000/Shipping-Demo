/** Details for one diagram item, as written in a section's data.json. */
export interface ItemDetails {
  description: string;
  /** Free-form label → value pairs, shown in order. */
  specs: Record<string, string>;
}

/** Shape of a section's data.json. Keys of `items` are diagram item IDs, e.g. "P-101". */
export interface SectionData {
  items: Record<string, ItemDetails>;
}

export function getItemDetails(data: SectionData, itemId: string): ItemDetails | undefined {
  return Object.hasOwn(data.items, itemId) ? data.items[itemId] : undefined;
}
