/**
 * Message contract between a ship's viewer (child, in an iframe) and the Ship Docs app (parent).
 * The two are built and deployed separately, so each keeps its own copy: the parent's is src/lib/viewer-protocol.ts,
 * which also checks every message it receives against it. Change both together, and keep changes backwards
 * compatible (add optional fields) so viewers built earlier keep working with the parent, and the other way round.
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
   * `shipId` is the ship this viewer project shows (from its ship.json). `sectionId` is null when it has no drawings.
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
