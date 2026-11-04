/**
 * Message contract between the viewer (child, in an iframe) and the Ship Docs app (parent).
 * Types only: the parent imports this file with `import type` via its "@child/protocol" alias,
 * so nothing here may depend on Vite or browser-only modules.
 */

/** Tag on every message so either side can ignore unrelated postMessage traffic. */
export type ViewerSource = "ship-viewer";

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
   * `sectionId` is null when the viewer has no drawings.
   */
  | { source: ViewerSource; type: "ready"; sections: SectionSummary[]; sectionId: string | null; item: SelectedItem | null }
  | { source: ViewerSource; type: "section-changed"; sectionId: string }
  | { source: ViewerSource; type: "item-selected"; item: SelectedItem | null };
