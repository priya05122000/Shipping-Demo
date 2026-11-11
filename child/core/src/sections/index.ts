// "@shipdocs/viewer-core/diagram": what a section is (types.ts), and what its views can ask the viewer for (context.tsx).
// Every section view, generated or hand-written, and every engine that draws one (e.g. ../pipeline) builds on these.
export {
  defineDiagram,
  type Diagram,
  type DiagramItem,
  type Section,
  type SectionView,
  type SectionViewProps,
} from "./types";
export { SectionProvider, useManualData, useSection, useSectionState, type ManualRecord } from "./context";
