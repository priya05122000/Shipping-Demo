import type { SectionViewProps } from "@shipdocs/viewer-core/diagram";
import { SchematicView3D } from "@/shared/schematic/3d";
import { schematic } from "./schematic";

/**
 * Bunker (SEC-001), 3D: the same schematic as the 2D view (./schematic.ts) as a react-three-fiber scene, sharing its
 * selection by drawing tag (or instance ID when untagged).
 */
export default function Diagram3D({ selectedId, onSelect }: SectionViewProps) {
  return <SchematicView3D schematic={schematic} selectedId={selectedId} onSelect={onSelect} hasData={false} />;
}
