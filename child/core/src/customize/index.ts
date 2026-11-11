// "@shipdocs/viewer-core/customize": what a ship's src/custom/ (layer 2, see types.ts) builds with.
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
} from "./types";
export type { DiagramItem, Section } from "../sections";
export type { SharedObject } from "../objects/registry";
export type { SelectedItem } from "../app/protocol";
// The viewer's building blocks, to build customized components and views from.
export { Badge, CubeIcon, DiagramIcon, DocumentIcon, EmptyState, SegmentedControl } from "../ui";
export { useShip } from "../ship/store";
