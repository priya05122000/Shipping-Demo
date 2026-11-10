// "@shipdocs/viewer-core/customize": what a ship's src/custom/ (layer 2, see customization.ts) builds with.
export {
  defineShipCustomization,
  type ActionContext,
  type BuiltInView,
  type CustomAction,
  type CustomView,
  type CustomViewProps,
  type HeaderProps,
  type ItemDetailsProps,
  type NoSectionsProps,
  type SectionNavProps,
  type ShipComponents,
  type ShipCustomization,
  type ShipHooks,
  type ShipInfo,
  type ShipLabels,
  type ShipTheme,
  type Slot,
  type ViewOption,
  type ViewSwitcherProps,
} from "./customization";
export type { DiagramItem, Section } from "./shared/diagram";
export type { SharedObject } from "./objects/registry";
export type { SelectedItem } from "./app/protocol";
// The viewer's building blocks, to build customized components and views from.
export { Badge, CubeIcon, DiagramIcon, DocumentIcon, EmptyState, SegmentedControl } from "./shared/ui";
export { useShip } from "./ship";
