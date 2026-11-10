import type { SectionViewProps } from "@shipdocs/viewer-core/diagram";
import { SchematicView2D } from "@/shared/schematic/2d";
import { schematic } from "./schematic";

/**
 * Bunker (SEC-001), 2D: the line diagram redrawn as an interactive SVG from ./schematic.ts. Items are selected by
 * their drawing tag (or instance ID when untagged), shared with the 3D view.
 */
export default function Diagram2D({ selectedId, onSelect }: SectionViewProps) {
  return <SchematicView2D schematic={schematic} selectedId={selectedId} onSelect={onSelect} hasData={false} />;
}
