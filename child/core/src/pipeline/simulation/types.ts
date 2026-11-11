/*
 * The plant's own data for a section's valves, in the engine's shape: each valve's `component` and
 * its troubleshooting guide come from the section's manual-data.json record that the schematic names
 * (`component`), and the systems' tanks and pumps from the schematic (see ../data/read.ts).
 */

export interface ComponentData {
  /** The plant's number for it, e.g. FA546. */
  id: string;
  /** Valve type as the source writes it, e.g. "BALL VALVE". Also the key of its troubleshooting guide. */
  type: string;
  system: string;
  location: string;
  usecase: string;
  spec: ComponentSpec;
  /** The pipe flow comes in through (the side nearer a manifold connection) and the one it leaves by. */
  pipes: { in: ComponentPipe; out: ComponentPipe };
  /** Ids in systemTanks and systemPumps. */
  related: string[];
}

export interface ComponentSpec {
  /** Nominal diameter, mm. */
  sizeDN: number;
  pressureRatingBar: number;
  /** Full opening, %. */
  openingPct: number;
  /** The most it passes fully open; the flow function never puts more through it. */
  ratedFlowM3h: number;
  flowPressureBar: number;
  /** Design pressures either side while flowing. */
  inletBar: number;
  outletBar: number;
  material: string;
  connection: string;
  /** How it is worked: lever, handwheel, gearbox or self-acting. Sets how long it takes to open or close. */
  operation: string;
}

export interface ComponentPipe {
  /** The source's id for it, e.g. PIPE_FA546_IN. */
  id: string;
  /** The diagram pipe on that side, or null where the valve is at an open end (a hose or landing connection). */
  pipe: string | null;
  line: string;
}

export type ValveStatus = 'OPEN' | 'CLOSED' | 'OPENING' | 'CLOSING';

/**
 * A component's live state, worked out by the flow function, in the fields of the source's
 * "simulation" block. It starts from the valve's `open`.
 */
export interface ComponentState {
  status: ValveStatus;
  positionPct: number;
  commandedPct: number;
  flowStatus: 'FLOWING' | 'NO_FLOW';
  flowM3h: number;
  inletBar: number;
  outletBar: number;
  fault: boolean;
  faultCode: string | null;
  animation: 'IDLE' | 'OPENING' | 'CLOSING' | 'FLOWING';
  flowing: boolean;
}

/** A tank of a system, which may be several tanks on the diagram. */
export interface SystemTank {
  name: string;
  /** One of FLUIDS. */
  fluid: string;
  system: string;
  /** The tanks on the diagram that make it up. */
  tags: string[];
}

export interface SystemPump {
  name: string;
  fluid: string;
  system: string;
  /** False when the drawing doesn't show it (it then stands for the supply at the hose). */
  onDiagram: boolean;
}

/** What to do about a valve that misbehaves. The source's sentences are split into one entry per step. */
export interface TroubleshootingGuide {
  failureCondition: string;
  symptoms: string[];
  possibleCauses: string[];
  diagnosticSteps: string[];
  immediateAction: string[];
  operationalImpact: string;
  verificationSteps: string[];
  preventionMeasures: string[];
}

/** A section's components gathered by tag, with what they refer to (see plantOf in sectionData.ts). */
export interface Plant {
  components: Record<string, ComponentData>;
  tanks: Record<string, SystemTank>;
  pumps: Record<string, SystemPump>;
  troubleshooting: Record<string, TroubleshootingGuide>;
}
