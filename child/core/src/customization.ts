import type { ComponentType, ReactNode } from "react";
import type { SelectedItem } from "./app/protocol";
import type { DiagramItem, Section } from "./shared/diagram";

/*
 * Layer 2 of a ship's viewer: its customizations, the UI and functionality that apply to that ship only.
 *
 *   Layer 1  common          child/core (this package)            every ship's viewer
 *   Layer 2  customization   child/ships/<ship>/src/custom/      one ship's changes to layer 1, through the extension
 *                                                                 points below
 *   Layer 3  content         child/ships/<ship>/ ship.json,     one ship's data (the Library) and generated code
 *                            src/sections, src/objects,
 *                            src/shared/schematic
 *
 * A ship's src/custom/index.tsx default-exports `defineShipCustomization({...})`; its manifest (../vite.js) brings it
 * in, so it's part of that ship's build only. Everything it doesn't customize is layer 1's, so changes there still
 * reach the ship. A component it replaces gets layer 1's own as `Default`, to wrap rather than copy it.
 * Keep these types backwards compatible (add optional fields): every ship's customizations are type-checked against them.
 *
 * Styling: a ship's own CSS (imported from its src/custom/, so it's in that ship's build only) can restyle the viewer
 * through these attributes, which stay put when the viewer's markup or classes change. Rules outside a CSS layer win
 * over the viewer's Tailwind classes.
 *   data-ui="viewer"                 the whole viewer
 *   data-ui="header"                 the header (standalone only)
 *   data-ui="section-nav"            the sidebar of sections, with data-collapsed while it shows only icons; its
 *                                    heading "section-nav-heading"; its collapse button "section-nav-toggle"; each
 *                                    button "section-nav-item", with data-section="<ID>" and data-active when it's open
 *   data-ui="section-toolbar"        the row with the section's title ("section-title"), summary ("section-summary"),
 *                                    actions and view switcher
 *   data-ui="view-switcher"          the view buttons: each "view-switcher-button", with data-value ("2d", "3d",
 *                                    "drawing", "manual", "custom:<id>") and data-selected when it's showing
 *   data-ui="section-actions"        the ship's own buttons (`actions`): each "action-button", with
 *                                    data-action="<id>" and data-variant ("primary" or "secondary")
 *   data-ui="view-panel"             the panel the current view is shown in
 *   data-ui="item-details"           the hotspot details panel
 *   data-ui="no-sections"            the message shown when the ship has no drawings
 */

/** The ship the viewer shows, from its ship.json. */
export interface ShipInfo {
  /** Unique, e.g. "SHP-001". The parent checks it when it embeds the viewer. */
  id: string;
  name: string;
}

/** A replaceable component: the ship's gets the same props, plus `Default`, the viewer's own, to wrap or fall back to. */
export type Slot<P> = ComponentType<P & { Default: ComponentType<P> }>;

/** The header, shown when the viewer runs on its own (inside Ship Docs, the parent's header is shown instead). */
export interface HeaderProps {
  ship: ShipInfo;
  /** The line under the ship's name (labels.subtitle). */
  subtitle: string;
  /** URL of the logo (theme.logo, or the viewer's). */
  logo: string;
}

/** The sidebar of sections (the viewer's own is collapsible, and shows each section's Icon.tsx). */
export interface SectionNavProps {
  sections: Section[];
  activeId: string;
  onSelect: (sectionId: string) => void;
}

/** The details of the hotspot selected on a line diagram (from a section's diagram.ts and data.json). */
export interface ItemDetailsProps {
  section: Section;
  item: DiagramItem | null;
}

/** Shown instead of a drawing when the ship has none. */
export interface NoSectionsProps {
  ship: ShipInfo;
}

/** A built-in view of a section. */
export type BuiltInView = "2d" | "3d" | "drawing" | "manual";

/** One of the section's views, as a button of the view switcher. */
export interface ViewOption {
  /** A built-in view, or "custom:<id>" for one of the ship's own views. */
  value: string;
  label: string;
}

/** The buttons that switch between a section's views (2D, 3D, Manual, and the ship's own). */
export interface ViewSwitcherProps {
  options: ViewOption[];
  /** The view showing now, one of the options' values. */
  value: string;
  onChange: (value: string) => void;
}

/** The viewer's components a ship can replace or wrap. */
export interface ShipComponents {
  Header: Slot<HeaderProps>;
  SectionNav: Slot<SectionNavProps>;
  ViewSwitcher: Slot<ViewSwitcherProps>;
  ItemDetails: Slot<ItemDetailsProps>;
  NoSections: Slot<NoSectionsProps>;
}

/** What one of the ship's own buttons (`actions`) gets when it's clicked. */
export interface ActionContext {
  ship: ShipInfo;
  section: Section;
  /** The selected item's tag, or null. */
  selectedId: string | null;
  /** Selects an item by tag (null clears the selection), as the views do. */
  onSelect: (id: string | null) => void;
  /** Shows one of the section's views: a built-in one ("2d", "3d", "drawing", "manual"), or one of the ship's own by its `id`. */
  showView: (view: string) => void;
}

/** A button of the ship's own, in the section's toolbar next to the view switcher. */
export interface CustomAction {
  /** Unique among the ship's actions, e.g. "report". Also its button's data-action, for styling. */
  id: string;
  label: string;
  /** Shown before the label, e.g. an icon from @shipdocs/viewer-core/customize. */
  icon?: ReactNode;
  /** "primary": filled with the accent colour; "secondary" (the default): light, with an outline. */
  variant?: "primary" | "secondary";
  /** Shown as the button's tooltip. */
  title?: string;
  /** The sections it's offered for; every section if it's left out. */
  appliesTo?: (section: Section) => boolean;
  /** Whether it's disabled right now, e.g. until an item is selected. */
  disabled?: (context: Pick<ActionContext, "ship" | "section" | "selectedId">) => boolean;
  onClick: (context: ActionContext) => void;
}

/** Props of a ship's own view of a section. */
export interface CustomViewProps {
  ship: ShipInfo;
  section: Section;
  /** The selected item's tag, shared with the 2D and 3D views, or null. */
  selectedId: string | null;
  /** Selects an item by tag (null clears the selection), as the 2D and 3D views do. */
  onSelect: (id: string | null) => void;
}

/** A view of its own, offered next to 2D, 3D, Drawing and Manual. */
export interface CustomView {
  /** Unique among the ship's views, e.g. "maintenance". */
  id: string;
  /** Its button's label, e.g. "Maintenance". */
  label: string;
  /** The sections it's offered for; every section if it's left out. */
  appliesTo?: (section: Section) => boolean;
  component: ComponentType<CustomViewProps>;
}

export interface ShipTheme {
  /**
   * The accent colour (active and selected things), replacing the viewer's charcoal: a CSS hex, rgb() or hsl() colour,
   * e.g. "#0f766e". Its lighter and darker shades are made from it. Objects' selection outlines (ObjectSymbol2D,
   * ObjectModel3D) use it too; a piping diagram's own hover and selection marks keep the viewer's.
   */
  accent?: string;
  /** URL of the logo, e.g. an image imported in src/custom (`import logo from "./logo.svg"`). */
  logo?: string;
}

/** Text the viewer shows. */
export interface ShipLabels {
  /** The line under the ship's name in the header. Default: "Interactive line diagrams". */
  subtitle: string;
  /** The view buttons' labels, e.g. { "2d": "Schematic", manual: "Handbook" }. Default: 2D, 3D, Drawing, Manual. */
  views: Partial<Record<BuiltInView, string>>;
}

/** Functionality: called by the viewer as things happen, or asked for something only this ship decides. */
export interface ShipHooks {
  /** Which sections the viewer offers, and in which order; the parent's list follows. Default: all, oldest first. */
  sections?: (sections: Section[]) => Section[];
  /** The line under a section's title; `standard` is the viewer's own, e.g. "Line diagram · Manual · 3 objects". */
  sectionSummary?: (section: Section, standard: string) => string;
  /** After a section is opened, by the viewer's user or by the parent. */
  onSectionOpen?: (section: Section) => void;
  /** After an item is selected (or the selection cleared, `item` null) in any view. */
  onItemSelect?: (item: SelectedItem | null, section: Section) => void;
}

/** One ship's customizations (layer 2). Every part is optional. */
export interface ShipCustomization {
  theme?: ShipTheme;
  labels?: Partial<ShipLabels>;
  components?: Partial<ShipComponents>;
  views?: CustomView[];
  actions?: CustomAction[];
  hooks?: ShipHooks;
}

/** Identity helper, so a ship's src/custom/index.tsx is checked against ShipCustomization. */
export function defineShipCustomization(customization: ShipCustomization): ShipCustomization {
  return customization;
}
