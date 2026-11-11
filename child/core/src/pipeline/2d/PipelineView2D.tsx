import { PipelineDiagram } from './PipelineDiagram';
import { PipelineView, type PipelineViewProps } from '../view/PipelineView';

/**
 * A section's piping diagram in 2D (SVG), for its Diagram2D.tsx:
 *
 *   export default function Diagram2D(props: SectionViewProps) {
 *     return <PipelineView2D schematic={schematic} {...props} />;
 *   }
 *
 * No three.js: that's only in "@shipdocs/viewer-core/pipeline/3d".
 */
export function PipelineView2D(props: PipelineViewProps) {
  return <PipelineView {...props} Diagram={PipelineDiagram} />;
}
