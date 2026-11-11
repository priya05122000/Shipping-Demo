import { useEffect, useMemo, useRef, type ComponentType, type ReactNode } from 'react';
import { findObject } from '../../objects/lookup';
import { useManualData, useSectionState } from '../../shared/diagram/context';
import type { SectionViewProps } from '../../shared/diagram/section';
import { readSectionData } from '../data/read';
import { computeReadings, type Reading } from '../data/readings';
import { buildDiagram, checkSectionData, type SectionData } from '../data/sectionData';
import { findCrossings, type Crossing } from '../diagram/crossings';
import { FLUIDS, fluidInfo, type DiagramDef, type DiagramLayout } from '../diagram/types';
import type { FlowRun } from '../operations/flow';
import { useOperations } from '../operations/useOperations';
import { InfoPanel } from './InfoPanel';
import { FLUID_STYLE } from './theme';
import { FOCUS_RING } from './ui';

/** What a piping diagram's drawing gets: PipelineDiagram (2D) and PipelineDiagram3D (3D). */
export interface DiagramProps {
  def: DiagramDef;
  crossings: Crossing[];
  data: SectionData;
  readings: Record<string, Reading>;
  /** Pipes with flow in them. */
  runs: FlowRun[];
  showValues: boolean;
  showTags: boolean;
  selected: string | null;
  onSelect: (tag: string | null) => void;
}

/** A section's piping diagram view: its 2D or 3D view's props, and the schematic it draws. */
export interface PipelineViewProps extends SectionViewProps {
  /** The section's schematic: its geometry file's default export, `definePipeline({...})`. */
  schematic: DiagramLayout;
}

const NO_RUNS: FlowRun[] = [];
const OVERVIEW_KEY = 'ship-viewer:overview-open';

function rememberedOverview(): boolean {
  try {
    return localStorage.getItem(OVERVIEW_KEY) !== '0';
  } catch {
    return true;
  }
}

/**
 * A piping diagram in a section's view panel, the same in 2D and 3D: a strip with the legend, the Values and Tags
 * switches and the alarm count; the drawing (`Diagram`); and the system overview, or the selected part's details,
 * beside it. Its parts' engineering data is the section's manual-data.json (useManualData, so this suspends until it
 * has loaded); its switches and the plant's state are kept for the section (useSectionState), so they carry over
 * between the 2D and 3D views.
 */
export function PipelineView({ schematic, selectedId, onSelect, Diagram }: PipelineViewProps & { Diagram: ComponentType<DiagramProps> }) {
  const manual = useManualData();
  const def = useMemo(() => buildDiagram(schematic), [schematic]);
  const read = useMemo(() => readSectionData(def, manual), [def, manual]);
  const crossings = useMemo(() => findCrossings(def.pipes), [def]);
  const ops = useOperations(def, read.data);
  const data = ops?.data ?? read.data;
  const live = ops?.live;
  const readings = useMemo(() => computeReadings(def, data, live), [def, data, live]);
  const runs = ops?.runs ?? NO_RUNS;
  const key = `pipeline:${def.id}`;
  const [showValues, setShowValues] = useSectionState(`${key}:values`, true);
  const [showTags, setShowTags] = useSectionState(`${key}:tags`, false);
  const [overviewOpen, setOverviewOpen] = useSectionState(`${key}:overview`, rememberedOverview);

  const showOverview = (open: boolean) => {
    setOverviewOpen(open);
    try {
      localStorage.setItem(OVERVIEW_KEY, open ? '1' : '0');
    } catch {
      // Not remembered across reloads; the toggle still works.
    }
  };

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    for (const problem of [...read.problems, ...checkSectionData(def, read.data, (id) => !!findObject(id))]) console.warn(problem);
  }, [def, read]);

  const alarmCount = Object.values(readings).filter((r) => r.status === 'alarm' || r.status === 'warn').length;
  const fluids = FLUIDS.filter((f) => def.pipes.some((p) => p.fluid === f));
  // Part details still open the panel while the overview is closed.
  const panelOpen = overviewOpen || selectedId !== null;
  // While the panel slides shut it keeps showing what it last showed open.
  const shownTag = useRef(selectedId);
  if (panelOpen) shownTag.current = selectedId;

  return (
    <div data-ui="pipeline" className="grid h-full min-h-0 min-w-0 grid-rows-[auto_1fr] max-wide:overflow-y-auto">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line px-3.5 py-2">
        <div className="flex flex-wrap gap-3.5 text-[12px] text-muted max-wide:hidden" aria-label="Legend">
          {fluids.map((f) => (
            <span key={f} className="inline-flex items-center gap-1.5">
              <i className="h-1.5 w-5.5 rounded-[3px] ring-2 ring-panel-2" style={{ background: FLUID_STYLE[f].liquid }} /> {fluidInfo(def, f).name} line
            </span>
          ))}
          {def.pipes.some((p) => p.dashed) && (
            <span className="inline-flex items-center gap-1.5">
              <i className="h-0 w-5.5 border-t-[3px] border-dashed border-line" /> Relief discharge
            </span>
          )}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex gap-2" role="group" aria-label="Callouts">
            <Toggle label="Values" on={showValues} onChange={setShowValues} />
            <Toggle label="Tags" on={showTags} onChange={setShowTags} />
          </div>
          {alarmCount > 0 && (
            <span className="rounded-full bg-warn px-2.5 py-0.75 text-[12px] font-[650] text-on-accent">
              {alarmCount} {alarmCount === 1 ? 'alarm' : 'alarms'}
            </span>
          )}
        </div>
      </div>

      {/* Below the wide breakpoint the info panel goes under the diagram instead of beside it. */}
      <div
        className={`relative grid min-h-0 transition-[grid-template-columns] duration-250 ease-slide motion-reduce:transition-none max-wide:grid-cols-1 ${
          panelOpen ? 'grid-cols-[1fr_340px] max-wide:grid-rows-[60vh_auto]' : 'grid-cols-[1fr_0px] max-wide:grid-rows-[1fr]'
        }`}
        data-layout-motion
      >
        <Diagram
          def={def}
          crossings={crossings}
          data={data}
          readings={readings}
          runs={runs}
          showValues={showValues}
          showTags={showTags}
          selected={selectedId}
          onSelect={onSelect}
        />
        <InfoPanel
          def={def}
          data={data}
          readings={readings}
          ops={ops}
          open={panelOpen}
          selected={shownTag.current}
          onSelect={onSelect}
          onCloseOverview={() => showOverview(false)}
        />
        {!panelOpen && (
          <OverviewButton onClick={() => showOverview(true)}>
            <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M15 4v16" />
            </svg>
            Overview
          </OverviewButton>
        )}
      </div>
    </div>
  );
}

function OverviewButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      className={`absolute top-3.5 right-3.5 inline-flex animate-fade-in cursor-pointer items-center gap-2 rounded-lg border border-line bg-panel/90 px-3 py-1.75 text-[13px] font-[550] text-muted hover:border-accent hover:text-ink motion-reduce:animate-none ${FOCUS_RING}`}
      onClick={onClick}
      aria-label="Open system overview"
      title="Open system overview"
    >
      {children}
    </button>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      className={`inline-flex cursor-pointer items-center gap-2 rounded-full border bg-panel-2 py-1.5 pr-3 pl-1.5 text-[13px] font-[550] transition-[border-color,color] duration-150 ${FOCUS_RING} ${
        on ? 'border-accent text-ink' : 'border-line text-muted'
      }`}
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
    >
      <span
        className={`relative h-4 w-7 rounded-full transition-colors duration-150 after:absolute after:top-0.5 after:left-0.5 after:size-3 after:rounded-full after:transition-transform after:duration-150 ${
          on ? 'bg-accent after:translate-x-3 after:bg-on-accent' : 'bg-line after:bg-panel'
        }`}
      />
      {label}
    </button>
  );
}
