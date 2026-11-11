import { PipelineDiagram3D } from './PipelineDiagram3D';
import { PipelineView, type PipelineViewProps } from './PipelineView';

/**
 * A section's piping diagram in 3D (React Three Fiber), for its Diagram3D.tsx:
 *
 *   export default function Diagram3D(props: SectionViewProps) {
 *     return <PipelineView3D schematic={schematic} {...props} />;
 *   }
 *
 * Same data, overview, selection and plant state as the 2D view (PipelineView2D).
 */
export function PipelineView3D(props: PipelineViewProps) {
  return <PipelineView {...props} Diagram={PipelineDiagram3D} />;
}
