import type { SectionViewProps } from "@shipdocs/viewer-core/diagram";
import { PipelineView3D } from "@shipdocs/viewer-core/pipeline/3d";
import schematic from "./schematic";

/** The bunker section in 3D: the same schematic and data as Diagram2D.tsx, with the same selection and plant state. */
export default function Diagram3D(props: SectionViewProps) {
  return <PipelineView3D schematic={schematic} {...props} />;
}
