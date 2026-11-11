import { placementOf } from '../diagram/partSpecs';
import { FLUIDS, type DiagramDef, type DiagramLayout, type Fluid, type PartDef, type PartKind } from '../diagram/types';
import type { ComponentData, Plant, SystemPump, SystemTank, TroubleshootingGuide } from '../operations/types';

/*
 * The engine's own shape of a section's data, read from its schematic and its manual-data.json (see read.ts).
 */

/** What every part has: the details shown in its tooltip and info panel. */
export interface PartDetails {
  name: string;
  /** One of FLUIDS in diagram/types.ts: "DO", "FO", "TR", "BK" or "RC". */
  fluid: string;
  line: string;
  area: string;
}

export interface ValveData extends PartDetails {
  open: boolean;
  /** The plant's data for it. A section whose valves have it gets flow, procedures and troubleshooting. */
  component?: ComponentData;
}

export interface ReliefValveData extends PartDetails {
  setPressureBar: number;
  /** Tag of the tank it protects. */
  protects?: string;
  component?: ComponentData;
}

export interface TankData extends PartDetails {
  capacityM3: number;
  levelPct: number;
  tempC: number;
  /** Level alarms (%): high, then high-high. */
  highPct: number;
  highHighPct: number;
  /** Tag of the valve on the tank inlet. */
  inletValve?: string;
  /** Tag of the valve on the tank outlet, for a tank that supplies the line. */
  outletValve?: string;
}

export interface PumpData extends PartDetails {
  running: boolean;
  /** Design capacity. */
  ratedM3h: number;
  /** Only needed while it runs. */
  suctionBar?: number;
  dischargeBar?: number;
}

export interface FilterData extends PartDetails {
  /** In service, or on standby with its valves shut. */
  inService: boolean;
  /** Pressure drop across it; only needed while in service. */
  dpBar?: number;
  /** The pressure drop at which it needs cleaning, and warns. */
  dpHighBar: number;
}

export interface HoseData extends PartDetails {
  connected: boolean;
  /** Only needed while a hose is connected. */
  pressureBar?: number;
  tempC?: number;
}

export interface GaugeData extends PartDetails {
  /** Tag of the manifold connection whose pressure it shows. */
  hose: string;
  /** Tag of its isolation valve; the gauge reads 0 while that valve is closed. */
  isolationValve?: string;
  /** Top of the dial, and the pressure above which it warns. */
  maxBar: number;
  highBar: number;
}

export type JointData = PartDetails;

/**
 * A section's data: one entry per part on its diagram, keyed by tag and grouped by type. With
 * components on its valves (from manual-data.json), also the systems' tanks and pumps they refer to
 * and a troubleshooting guide for each component (by its id; a valve type also works as the key).
 */
export interface SectionData {
  valves: Record<string, ValveData>;
  reliefValves: Record<string, ReliefValveData>;
  tanks: Record<string, TankData>;
  hoses: Record<string, HoseData>;
  gauges: Record<string, GaugeData>;
  joints: Record<string, JointData>;
  pumps: Record<string, PumpData>;
  filters: Record<string, FilterData>;
  systemTanks?: Record<string, SystemTank>;
  systemPumps?: Record<string, SystemPump>;
  troubleshooting?: Record<string, TroubleshootingGuide>;
}

type PartGroup = Exclude<keyof SectionData, 'systemTanks' | 'systemPumps' | 'troubleshooting'>;

/** Which group holds each type of part. */
export const GROUP_OF: Record<PartKind, PartGroup> = {
  BFV: 'valves',
  GLV: 'valves',
  BV: 'valves',
  HV: 'valves',
  MBV: 'valves',
  NRV: 'valves',
  PSV: 'reliefValves',
  TK: 'tanks',
  MC: 'hoses',
  PI: 'gauges',
  DJ: 'joints',
  PU: 'pumps',
  FL: 'filters',
};

const isFluid = (f: string): f is Fluid => (FLUIDS as readonly string[]).includes(f);

/**
 * The section's schematic as the engine draws it: each part with its defaults filled in, and the Library object that
 * draws it (its own `object`, else the schematic's `objects` for its kind) when it's drawn with a picture.
 */
export function buildDiagram(layout: DiagramLayout): DiagramDef {
  const fallbackFluid = layout.pipes[0]?.fluid ?? FLUIDS[0];
  const parts: PartDef[] = layout.parts.map((p) => ({
    ...p,
    name: p.name || p.tag,
    fluid: p.fluid && isFluid(p.fluid) ? p.fluid : fallbackFluid,
    line: p.line ?? '—',
    area: p.area ?? '—',
    object: p.object ?? (placementOf(p) ? layout.objects?.[p.kind] : undefined),
  }));
  return { ...layout, parts };
}

/** The section's components by tag, with the systems and guides they refer to; null if its valves have none. */
export function plantOf(data: SectionData): Plant | null {
  const components: Record<string, ComponentData> = {};
  for (const [tag, v] of [...Object.entries(data.valves), ...Object.entries(data.reliefValves)]) if (v.component) components[tag] = v.component;
  if (!Object.keys(components).length) return null;
  return { components, tanks: data.systemTanks ?? {}, pumps: data.systemPumps ?? {}, troubleshooting: data.troubleshooting ?? {} };
}

/**
 * Places where the schematic disagrees with itself, with the ship's Library objects or with manual-data.json, as
 * readable messages. `hasObject` says whether the ship has an object (src/objects/<id>).
 */
export function checkSectionData(def: DiagramDef, data: SectionData, hasObject: (id: string) => boolean): string[] {
  const problems: string[] = [];
  const at = `${def.id} schematic`;
  const groupOfTag = new Map(def.parts.map((p) => [p.tag, GROUP_OF[p.kind]]));
  const refersTo = (from: string, field: string, tag: string | undefined, group: PartGroup) => {
    if (tag !== undefined && groupOfTag.get(tag) !== group) problems.push(`${at}: ${from}.${field} "${tag}" is not one of its ${group}`);
  };

  for (const p of def.parts) {
    if (!placementOf(p)) continue;
    if (!p.object) problems.push(`${at}: no Library object draws ${p.tag} (a ${p.kind}): name one in objects.${p.kind} or the part's object`);
    else if (!hasObject(p.object)) problems.push(`${at}: ${p.tag}'s object ${p.object} isn't one of the ship's objects (src/objects/)`);
  }
  for (const [tag, t] of Object.entries(data.tanks)) {
    refersTo(tag, 'tank.inletValve', t.inletValve, 'valves');
    refersTo(tag, 'tank.outletValve', t.outletValve, 'valves');
  }
  for (const [tag, r] of Object.entries(data.reliefValves)) refersTo(tag, 'relief.protects', r.protects, 'tanks');
  for (const [tag, g] of Object.entries(data.gauges)) {
    refersTo(tag, 'gauge.hose', g.hose, 'hoses');
    refersTo(tag, 'gauge.isolationValve', g.isolationValve, 'valves');
  }

  const plant = plantOf(data);
  const pipeIds = new Set(def.pipes.map((p) => p.id));
  for (const [tag, c] of Object.entries(plant?.components ?? {})) {
    if (!plant!.troubleshooting[c.id] && !plant!.troubleshooting[c.type]) {
      problems.push(`${tag}: its component ${c.id} has no troubleshooting in manual-data.json`);
    }
    for (const p of [c.pipes.in, c.pipes.out]) {
      if (p.pipe !== null && !pipeIds.has(p.pipe)) problems.push(`${at}: ${tag}.pipes "${p.pipe}" isn't one of its pipes`);
    }
    for (const id of c.related) {
      if (!plant!.tanks[id] && !plant!.pumps[id]) problems.push(`${at}: ${tag}.related "${id}" is in neither systems.tanks nor systems.pumps`);
    }
  }
  for (const [id, t] of Object.entries(data.systemTanks ?? {})) {
    for (const tag of t.tags) refersTo(`systems.tanks.${id}`, 'tags', tag, 'tanks');
  }
  return problems;
}
