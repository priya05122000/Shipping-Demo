import type { ComponentData, ComponentPipe, TroubleshootingGuide } from '../simulation/types';
import type { DiagramDef, PartDef } from '../model/types';
import { GROUP_OF, type PartDetails, type SectionData } from './sectionData';

/*
 * A piping diagram's data. Its engineering data comes from the section's manual-data.json, which the Library writes
 * from the section's manual (PDF) and writes again when a new manual is uploaded: one record per component, keyed by
 * its engineering tag (`id`). A part on the drawing names its record with `component` (in the section's schematic),
 * which gives its type, specifications, troubleshooting and starting position. What only the drawing shows (a part's
 * name, fluid, line and area, a tank's level or a hose's state) is in the schematic, next to the geometry.
 * The records are read as the Library writes them: any field can be missing, and is then left at a neutral value.
 */

/** One component in manual-data.json, as the Library writes it from the manual. Only the fields used; all optional. */
export interface ManualComponent {
  /** Its engineering tag, e.g. "FB112". */
  id: string;
  component_name?: unknown;
  component_type?: unknown;
  identification?: { system_name?: unknown; location?: unknown; line_number?: unknown };
  specifications?: {
    /** A valve's type, e.g. "BALL VALVE". */
    valve_type?: unknown;
    /** mm */
    nominal_diameter?: unknown;
    material?: unknown;
    connection_type?: unknown;
    /** Lever, handwheel, gearbox or self-acting: how long it takes to open or close. */
    operation_type?: unknown;
    /** bar */
    pressure_rating?: unknown;
    /** Full opening, %. */
    valve_opening?: unknown;
    /** The most it passes fully open, m³/h. */
    flow_rate?: unknown;
    /** bar */
    flow_pressure?: unknown;
    /** Design pressures either side while flowing, bar. */
    pressure_inlet?: unknown;
    pressure_outlet?: unknown;
  };
  usecase?: unknown;
  /** Each a sentence or a comma-separated list; split into one entry per step for the troubleshooting guide. */
  troubleshooting?: {
    failure_condition?: unknown;
    symptoms?: unknown;
    possible_causes?: unknown;
    diagnostic_steps?: unknown;
    immediate_action?: unknown;
    operational_impact?: unknown;
    verification_steps?: unknown;
    prevention_measures?: unknown;
  };
  /** "OPEN" or "CLOSED": a valve's position at the start. */
  simulation?: { current_status?: unknown };
  /** Its pipes in the plant's numbering, inlet then outlet, e.g. "PIPE_FB112_IN, PIPE_FB112_OUT". */
  relationships?: { connected_pipe_ids?: unknown; related_component_ids?: unknown };
}

const num = (value: unknown, fallback = 0): number => {
  const n = typeof value === 'string' ? Number.parseFloat(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback;
};
const str = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback);
const list = (value: unknown): string[] =>
  str(value)
    .split(/\s*,\s*/)
    .filter(Boolean);
const isOpen = (status: unknown) => typeof status === 'string' && status.trim().toUpperCase() === 'OPEN';
const asObject = <T,>(value: unknown): Partial<T> => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Partial<T>) : {});

// ── Troubleshooting text into steps ─────────────────────────────────────────

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const sentences = (text: unknown) =>
  str(text)
    .split(/\.\s+/)
    .map((s) => s.trim().replace(/\.$/, ''))
    .filter(Boolean);
const clauses = (sentence: string) =>
  sentence
    .split(/,\s+|;\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

/** A list of things (symptoms, causes): one entry per comma-separated item. */
function listItems(text: unknown): string[] {
  return sentences(text).flatMap(clauses).map(capitalize);
}

/** Words a new step starts with; a clause that doesn't start with one belongs to the step before it. */
const STEP_START =
  /^(alert|allow|apply|arrange|avoid|calibrate|check|clean|close|compare|confirm|consult|contact|cycle|depressuri[sz]e|do|document|drain|ensure|exercise|flush|follow|inform|inspect|isolate|keep|let|listen|lock|log|lubricate|maintain|measure|monitor|never|notify|observe|obtain|open|operate|perform|record|refer|remove|repair|replace|report|reset|restart|restore|resume|return|review|schedule|secure|shut|start|stop|switch|tag|test|tighten|use|vent|verify|wait)\b/i;

/** A list of steps (diagnose, act, verify, prevent): split where a new instruction starts. */
function listSteps(text: unknown): string[] {
  const steps: string[] = [];
  for (const sentence of sentences(text)) {
    let step: string | null = null;
    for (const clause of clauses(sentence)) {
      // "Never gag, isolate or adjust …": a short prohibition takes the verbs after it.
      const prohibition = step !== null && /^(never|do not|don't)\b/i.test(step) && step.split(/\s+/).length <= 2;
      if (step === null || (STEP_START.test(clause) && !prohibition)) {
        if (step !== null) steps.push(step);
        step = clause;
      } else {
        step += `, ${clause}`;
      }
    }
    if (step !== null) steps.push(step);
  }
  return steps.map(capitalize);
}

function toGuide(raw: unknown): TroubleshootingGuide {
  const t = asObject<NonNullable<ManualComponent['troubleshooting']>>(raw);
  return {
    failureCondition: str(t.failure_condition),
    symptoms: listItems(t.symptoms),
    possibleCauses: listItems(t.possible_causes),
    diagnosticSteps: listSteps(t.diagnostic_steps),
    immediateAction: listSteps(t.immediate_action),
    operationalImpact: str(t.operational_impact),
    verificationSteps: listSteps(t.verification_steps),
    preventionMeasures: listSteps(t.prevention_measures),
  };
}

// ── Components ──────────────────────────────────────────────────────────────

function toComponent(record: ManualComponent, part: PartDef, pipeLines: ReadonlyMap<string, string>): ComponentData {
  const spec = asObject<NonNullable<ManualComponent['specifications']>>(record.specifications);
  const pipeIds = list(asObject<NonNullable<ManualComponent['relationships']>>(record.relationships).connected_pipe_ids);
  const pipe = (side: 'in' | 'out', index: number): ComponentPipe => {
    const onDiagram = part.pipes?.[side] ?? null;
    return {
      id: pipeIds[index] ?? `PIPE_${record.id}_${side.toUpperCase()}`,
      pipe: onDiagram,
      // The line of the diagram pipe on that side (a relief valve's discharge is its own), else the part's.
      line: (onDiagram && pipeLines.get(onDiagram)) || part.line,
    };
  };
  const identification = asObject<NonNullable<ManualComponent['identification']>>(record.identification);
  return {
    id: record.id,
    type: str(spec.valve_type, str(record.component_type)),
    system: str(identification.system_name),
    location: str(identification.location),
    usecase: str(record.usecase),
    spec: {
      sizeDN: num(spec.nominal_diameter),
      pressureRatingBar: num(spec.pressure_rating),
      openingPct: num(spec.valve_opening, 100),
      ratedFlowM3h: num(spec.flow_rate),
      flowPressureBar: num(spec.flow_pressure),
      inletBar: num(spec.pressure_inlet),
      outletBar: num(spec.pressure_outlet),
      material: str(spec.material),
      connection: str(spec.connection_type),
      operation: str(spec.operation_type),
    },
    pipes: { in: pipe('in', 0), out: pipe('out', 1) },
    related: part.related ?? list(asObject<NonNullable<ManualComponent['relationships']>>(record.relationships).related_component_ids),
  };
}

/** manual-data.json's records (anything else in it is skipped), by engineering tag. */
export function componentsById(manual: readonly unknown[]): Map<string, ManualComponent> {
  const byId = new Map<string, ManualComponent>();
  for (const value of manual) {
    const record = value as ManualComponent | null;
    if (record && typeof record === 'object' && typeof record.id === 'string' && record.id) byId.set(record.id, record);
  }
  return byId;
}

/**
 * The section's data in the engine's shape: each part from the schematic, with a valve's component, troubleshooting
 * guide and starting position from its manual-data.json record; and, as readable messages, the parts whose
 * `component` has no record there.
 */
export function readSectionData(def: DiagramDef, manual: readonly unknown[]): { data: SectionData; problems: string[] } {
  const records = componentsById(manual);
  const pipeLines = new Map(def.pipes.map((pipe) => [pipe.id, pipe.line]));
  const troubleshooting: Record<string, TroubleshootingGuide> = {};
  const problems: string[] = [];
  const data: SectionData = { valves: {}, reliefValves: {}, tanks: {}, hoses: {}, gauges: {}, joints: {}, pumps: {}, filters: {} };

  /** The part's component from its record, if it names one that's there. */
  const componentOf = (part: PartDef) => {
    if (!part.component) return { component: undefined, record: undefined };
    const record = records.get(part.component);
    if (!record) {
      problems.push(`${part.tag}: its component "${part.component}" has no record in manual-data.json, so it has no engineering data`);
      return { component: undefined, record: undefined };
    }
    if (record.troubleshooting) troubleshooting[record.id] = toGuide(record.troubleshooting);
    return { component: toComponent(record, part, pipeLines), record };
  };

  for (const part of def.parts) {
    const details: PartDetails = { name: part.name, fluid: part.fluid, line: part.line, area: part.area };
    switch (GROUP_OF[part.kind]) {
      case 'valves': {
        const { component, record } = componentOf(part);
        const status = asObject<NonNullable<ManualComponent['simulation']>>(record?.simulation).current_status;
        data.valves[part.tag] = { ...details, open: status === undefined ? (part.open ?? false) : isOpen(status), component };
        break;
      }
      case 'reliefValves': {
        const { component } = componentOf(part);
        data.reliefValves[part.tag] = { ...details, setPressureBar: part.relief?.setPressureBar ?? 0, protects: part.relief?.protects, component };
        break;
      }
      case 'tanks':
        data.tanks[part.tag] = { ...details, capacityM3: 0, levelPct: 0, tempC: 0, highPct: 100, highHighPct: 100, ...part.tank };
        break;
      case 'hoses':
        data.hoses[part.tag] = { ...details, connected: false, ...part.hose };
        break;
      case 'gauges':
        data.gauges[part.tag] = { ...details, hose: '', maxBar: 16, highBar: 16, ...part.gauge };
        break;
      case 'joints':
        data.joints[part.tag] = details;
        break;
      case 'pumps':
        data.pumps[part.tag] = { ...details, running: false, ratedM3h: 0, ...part.pump };
        break;
      case 'filters':
        data.filters[part.tag] = { ...details, inService: false, dpHighBar: 0, ...part.filter };
        break;
    }
  }
  return {
    data: { ...data, systemTanks: def.systems?.tanks ?? {}, systemPumps: def.systems?.pumps ?? {}, troubleshooting },
    problems,
  };
}
