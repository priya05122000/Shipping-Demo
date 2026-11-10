import { defineShipCustomization } from "@shipdocs/viewer-core/customize";

/**
 * This ship's customizations: UI and functionality for this ship only (layer 2). The viewer itself is shared by every
 * ship (@shipdocs/viewer-core, layer 1), and this ship's content is its data and generated code (layer 3). Whatever
 * isn't customized here stays the shared viewer's, so its changes still reach this ship.
 *
 * Every part is optional, and type-checked against the shared viewer's extension points:
 *   theme       { accent: "#0f766e", logo }      the accent colour and logo (import an image from this folder)
 *   labels      { subtitle, views: { "2d": "Schematic" } }
 *               text the viewer shows, including the view buttons' labels
 *   components  { Header, SectionNav, ViewSwitcher, ItemDetails, NoSections }
 *               replace or wrap the viewer's own: each gets its props plus `Default`, the viewer's component
 *   views       [{ id, label, component, appliesTo? }]
 *               views of this ship's own, next to 2D, 3D and Manual; `component` gets the section and the selection
 *   actions     [{ id, label, onClick, icon?, variant?, disabled?, appliesTo? }]
 *               buttons of this ship's own in the section's toolbar; `onClick` gets the section, the selection and
 *               showView()
 *   hooks       { sections, sectionSummary, onSectionOpen, onItemSelect }
 *               functionality: which sections to offer and in which order, the summary line, and what to do as the
 *               user opens sections and selects items
 * To restyle the viewer's buttons and other parts for this ship only, import a CSS file here and target their data-ui
 * attributes, e.g. [data-ui="view-switcher-button"]. Put the components, views, styles and data they use in this
 * folder. See child/README.md for examples.
 */
export default defineShipCustomization({});
