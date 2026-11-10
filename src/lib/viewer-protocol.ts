/**
 * Message contract between Ship Docs (the parent) and a ship's viewer (child, in an iframe).
 *
 * The viewers are built and deployed on their own (child/), so the parent keeps its own copy of the contract rather
 * than importing the child's (child/core/src/app/protocol.ts): nothing in child/ is part of this app's build. And it
 * never trusts what a viewer sends: parseViewerEvent checks each message against the shapes below and drops anything
 * else, so a viewer built from older or newer code can't break this app. Change both copies together, and keep changes
 * backwards compatible (add optional fields; unknown fields are ignored).
 */

/** Tag on every message so either side can ignore unrelated postMessage traffic. */
export const VIEWER_SOURCE = "ship-viewer";
export type ViewerSource = typeof VIEWER_SOURCE;

export interface SectionSummary {
  id: string;
  title: string;
}

export interface SelectedItem {
  id: string;
  label: string;
  sectionId: string;
}

/** Parent → child. */
export type ViewerCommand = { source: ViewerSource; type: "open-section"; sectionId: string };

/** Child → parent. */
export type ViewerEvent =
  /**
   * Full viewer state. Sent once the viewer can take commands, and again after a reload or a dev hot update.
   * `shipId` is the ship the viewer shows (from its ship.json). `sectionId` is null when it has no drawings.
   */
  | {
      source: ViewerSource;
      type: "ready";
      shipId: string;
      sections: SectionSummary[];
      sectionId: string | null;
      item: SelectedItem | null;
    }
  | { source: ViewerSource; type: "section-changed"; sectionId: string }
  | { source: ViewerSource; type: "item-selected"; item: SelectedItem | null };

type Fields = Record<string, unknown>;

function isRecord(value: unknown): value is Fields {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sectionSummary(value: unknown): SectionSummary | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.title !== "string") return null;
  return { id: value.id, title: value.title };
}

/** A selected item, null for "nothing selected", or undefined if the value isn't one. */
function selectedItem(value: unknown): SelectedItem | null | undefined {
  if (value === null) return null;
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.label !== "string" || typeof value.sectionId !== "string") {
    return undefined;
  }
  return { id: value.id, label: value.label, sectionId: value.sectionId };
}

/**
 * The viewer event in a message's data, with only the fields this app knows, or null if it isn't a valid one (another
 * window's message, or a viewer whose messages this app doesn't understand).
 */
export function parseViewerEvent(data: unknown): ViewerEvent | null {
  if (!isRecord(data) || data.source !== VIEWER_SOURCE) return null;
  switch (data.type) {
    case "ready": {
      if (typeof data.shipId !== "string" || !Array.isArray(data.sections)) return null;
      const sections = data.sections.map(sectionSummary);
      const item = selectedItem(data.item);
      if (sections.some((section) => section === null) || item === undefined) return null;
      if (data.sectionId !== null && typeof data.sectionId !== "string") return null;
      return {
        source: VIEWER_SOURCE,
        type: "ready",
        shipId: data.shipId,
        sections: sections as SectionSummary[],
        sectionId: data.sectionId,
        item,
      };
    }
    case "section-changed":
      return typeof data.sectionId === "string" ? { source: VIEWER_SOURCE, type: "section-changed", sectionId: data.sectionId } : null;
    case "item-selected": {
      const item = selectedItem(data.item);
      return item === undefined ? null : { source: VIEWER_SOURCE, type: "item-selected", item };
    }
    default:
      return null;
  }
}
