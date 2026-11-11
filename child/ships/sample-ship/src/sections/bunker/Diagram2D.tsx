import type { SectionViewProps } from "@shipdocs/viewer-core/diagram";
import { PipelineView2D } from "@shipdocs/viewer-core/pipeline";
import schematic from "./schematic";

/**
 * The bunker section in 2D: its schematic (./schematic.ts) as a live piping diagram, drawn with the Library objects it
 * names, its components' data from this folder's manual-data.json.
 */
export default function Diagram2D(props: SectionViewProps) {
  return <PipelineView2D schematic={schematic} {...props} />;
}
