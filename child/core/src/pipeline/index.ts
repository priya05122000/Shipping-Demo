/*
 * "@shipdocs/viewer-core/pipeline": live piping diagrams, for any section of any ship. A section shows one from the
 * files every section has (see child/README.md, "Piping diagrams"):
 *   section.json, line diagram, manual   the Library's, with the Library objects picked for the section
 *   manual-data.json   the Library's, read from the manual: its components' specifications, troubleshooting and
 *                      starting positions, which the diagram reads (useManualData)
 *   schematic.ts       the drawing: `export default definePipeline({...})`, its pipes and parts, what it shows about
 *                      each part (name, fluid, line, area, a tank's level…), its `component` (engineering tag in
 *                      manual-data.json), and the Library objects that draw each kind of part
 *   Diagram2D.tsx      `export default (props: SectionViewProps) => <PipelineView2D schematic={schematic} {...props} />`
 *   Diagram3D.tsx      the same with PipelineView3D, from "@shipdocs/viewer-core/pipeline/3d" (three.js)
 * The viewer shows them as the section's 2D and 3D views; the engine (drawing, 3D scene, simulation, overview) is here,
 * so every ship and section gets its changes.
 */
import type { DiagramLayout } from './model/types';

/** Identity helper, so a section's schematic (`export default definePipeline({...})`) is checked against `DiagramLayout`. */
export function definePipeline(schematic: DiagramLayout): DiagramLayout {
  return schematic;
}

export { PipelineView2D } from './2d/PipelineView2D';
export type { PipelineViewProps } from './view/PipelineView';
export type { ManualComponent } from './data/read';
export {
  FLUID_INFO,
  FLUIDS,
  type Decoration,
  type DiagramDef,
  type DiagramLayout,
  type Fluid,
  type PartDef,
  type PartFacts,
  type PartKind,
  type PartLayout,
  type PipeDef,
  type PipelineSystems,
  type PipeSize,
  type Pt,
  type Side,
  type TextLabel,
} from './model/types';
export type { SystemPump, SystemTank } from './simulation/types';
