import type { SectionData } from '../data/sectionData';
import { VALVE_KINDS } from '../model/partSpecs';
import type { DiagramDef, PipeDef, Pt } from '../model/types';
import { otherEnd, type NetEdge, type NetNode, type Network } from './network';
import type { ComponentState, Plant } from './types';

/*
 * The flow function. Fuel comes in through the manifold connection being supplied and goes wherever
 * the open valves let it, into the tanks at the ends. Valves take time to open and close (by how
 * they are worked), the supply comes up to rate slowly, and the receiving tanks fill.
 */

/** Simulated time runs this much faster than the clock, so tank levels visibly rise. */
export const TIME_SCALE = 120;
/** Seconds the supply takes to come up to full rate after starting. */
const RAMP_SECONDS = 4;
/** Delivery rate where no valve on the way limits it, m³/h. */
const DEFAULT_RATE = 40;
const DEFAULT_SUPPLY_BAR = 4.2;
/** A closed valve with a passing seat lets through this share of its rated flow. */
const PASSING_SHARE = 0.1;
/** A restricted valve passes this share of its rated flow fully open, and drops this much pressure. */
const RESTRICTED_SHARE = 0.4;
const RESTRICTED_DROP_BAR = 1.2;

export type FaultKind = 'STUCK' | 'PASSING' | 'RESTRICTED';

/** Faults that can be put on a valve to try out troubleshooting. */
export const FAULTS: Record<FaultKind, { label: string; text: string }> = {
  STUCK: { label: 'Stuck', text: "doesn't move when operated" },
  PASSING: { label: 'Seat passing', text: 'lets some flow through while closed' },
  RESTRICTED: { label: 'Restricted', text: 'partly blocked: less flow and a high pressure drop' },
};

/** Seconds a valve takes from closed to fully open, by how it is worked. */
export function travelSeconds(operation: string | undefined): number {
  const op = (operation ?? '').toLowerCase();
  if (op.includes('lever')) return 1.2;
  if (op.includes('self-closing') || op.includes('spring')) return 1;
  if (op.includes('handwheel')) return 2.5;
  if (op.includes('gearbox')) return 3.5;
  return 2;
}

/** What the flow function works from: the drawing, the section's data and the components in it. */
export interface FlowContext {
  def: DiagramDef;
  net: Network;
  data: SectionData;
  plant: Plant;
}

/** What changes while the page is open. */
export interface FlowState {
  /** Seconds since the page opened (clock time, not simulated). */
  time: number;
  /** Each valve's opening (%), where it was last told to go, and when. */
  position: Record<string, number>;
  commanded: Record<string, number>;
  commandedAt: Record<string, number>;
  hoses: Record<string, boolean>;
  levels: Record<string, number>;
  /** The manifold connection being supplied, and since when. */
  supply: { source: string; since: number } | null;
  faults: Record<string, FaultKind>;
  /** Something that happened on its own, such as a high-high level stopping the supply. */
  message: string | null;
}

/** Valves that can be worked: all but the relief valves, which only lift on their own. */
export const isOperable = (ctx: FlowContext, tag: string) => {
  const kind = ctx.net.parts.get(tag)?.kind;
  return kind !== undefined && kind !== 'PSV' && VALVE_KINDS.has(kind);
};

/** Everything as the section starts: each valve fully open or shut by its `open`, no supply, no faults. */
export function initialFlowState(ctx: FlowContext): FlowState {
  const position: Record<string, number> = {};
  for (const p of ctx.def.parts) if (isOperable(ctx, p.tag)) position[p.tag] = ctx.data.valves[p.tag]?.open ? 100 : 0;
  return {
    time: 0,
    position,
    commanded: { ...position },
    commandedAt: Object.fromEntries(Object.keys(position).map((t) => [t, 0])),
    hoses: Object.fromEntries(Object.entries(ctx.data.hoses).map(([t, h]) => [t, h.connected])),
    levels: Object.fromEntries(Object.entries(ctx.data.tanks).map(([t, k]) => [t, k.levelPct])),
    supply: null,
    faults: {},
    message: null,
  };
}

/** A piece of pipe with flow in it, in the direction of flow. */
export interface FlowEdge {
  edge: NetEdge;
  from: NetNode;
  to: NetNode;
  /** Distance from the source to `from`, along the pipes. */
  start: number;
  rate: number;
}

export interface ValveFlow {
  rate: number;
  flowing: boolean;
  inletBar: number;
  outletBar: number;
}

/** Where the flow goes at one moment. */
export interface FlowTrace {
  source: string | null;
  /** Total delivery, m³/h. */
  rate: number;
  supplyBar: number;
  edges: FlowEdge[];
  /** Valves the supply reaches (pressurised, flowing or not). */
  valves: Record<string, ValveFlow>;
  /** Flow into each receiving tank, m³/h. */
  tanks: Record<string, number>;
}

const NO_FLOW: FlowTrace = { source: null, rate: 0, supplyBar: 0, edges: [], valves: {}, tanks: {} };

/** How much of a valve's rated flow it can pass now: 0 when shut. Parts that aren't valves pass everything. */
function passShare(ctx: FlowContext, state: FlowState, n: NetNode): number {
  const tag = n.part;
  if (!tag) return 1;
  const kind = ctx.net.parts.get(tag)!.kind;
  if (kind === 'PSV') return 0;
  if (!VALVE_KINDS.has(kind)) return 1;
  const open = (state.position[tag] ?? 0) / 100;
  const fault = state.faults[tag];
  if (open <= 0) return fault === 'PASSING' ? PASSING_SHARE : 0;
  return open * (fault === 'RESTRICTED' ? RESTRICTED_SHARE : 1);
}

/**
 * Traces the flow from the supplied manifold connection through the open valves. The tanks reached
 * share the delivery equally, and the delivery is as much as the most limiting valve allows.
 */
export function traceFlow(ctx: FlowContext, state: FlowState): FlowTrace {
  const supply = state.supply;
  const root = supply && state.hoses[supply.source] ? ctx.net.nodeOf.get(supply.source) : undefined;
  if (!supply || !root) return NO_FLOW;

  // Spread out from the source; closed valves and tanks are reached but not passed.
  const via = new Map<NetNode, NetEdge | null>([[root, null]]);
  const depth = new Map<NetNode, number>([[root, 0]]);
  const children = new Map<NetNode, NetNode[]>();
  const order: NetNode[] = [];
  const stack = [root];
  while (stack.length) {
    const n = stack.pop()!;
    order.push(n);
    if (n !== root && (n.tank || passShare(ctx, state, n) === 0)) continue;
    for (const e of n.edges) {
      const m = otherEnd(e, n);
      if (via.has(m)) continue;
      via.set(m, e);
      depth.set(m, depth.get(n)! + e.len);
      children.set(n, [...(children.get(n) ?? []), m]);
      stack.push(m);
    }
  }

  // What each node can pass on to the tanks beyond it: the least of its own valve's capacity and what
  // its branches take. A tank takes anything; a dead end or a shut valve takes nothing.
  const spec = (n: NetNode) => (n.part ? ctx.plant.components[n.part]?.spec : undefined);
  const capacity = new Map<NetNode, number>();
  for (const n of [...order].reverse()) {
    if (n !== root && n.tank) {
      capacity.set(n, Infinity);
      continue;
    }
    const beyond = (children.get(n) ?? []).reduce((s, c) => s + capacity.get(c)!, 0);
    const s = spec(n);
    capacity.set(n, Math.min(beyond, s ? s.ratedFlowM3h * passShare(ctx, state, n) : Infinity));
  }

  // The supply comes up to rate and pressure over RAMP_SECONDS.
  const ramp = Math.min(1, (state.time - supply.since) / RAMP_SECONDS);
  const fullBar = ctx.data.hoses[supply.source]?.pressureBar ?? DEFAULT_SUPPLY_BAR;
  const most = capacity.get(root)!;
  const rate = (Number.isFinite(most) ? most : DEFAULT_RATE) * ramp;

  // Hand the delivery down the branches in proportion to what each can take.
  const flow = new Map<NetNode, number>([[root, rate]]);
  const weight = (n: NetNode) => Math.min(capacity.get(n)!, 1e6);
  for (const n of order) {
    const kids = children.get(n) ?? [];
    const sum = kids.reduce((s, c) => s + weight(c), 0);
    for (const c of kids) flow.set(c, sum > 0 ? (flow.get(n)! * weight(c)) / sum : 0);
  }

  const edges: FlowEdge[] = [];
  const tanks: Record<string, number> = {};
  const valves: Record<string, ValveFlow> = {};
  for (const n of order) {
    const q = flow.get(n)!;
    const e = via.get(n);
    if (e && q > 0) edges.push({ edge: e, from: otherEnd(e, n), to: n, start: depth.get(otherEnd(e, n))!, rate: q });
    if (n !== root && n.tank && q > 0) tanks[n.tank] = (tanks[n.tank] ?? 0) + q;
    if (!n.part || !isOperable(ctx, n.part)) continue;
    const s = spec(n);
    const inlet = (s?.inletBar ?? fullBar) * ramp;
    // Flowing: the design drop (much more if restricted). Standing: no drop through an open valve, nothing past a shut one.
    const outlet =
      q > 0
        ? state.faults[n.part] === 'RESTRICTED'
          ? Math.max(0, inlet - RESTRICTED_DROP_BAR * ramp)
          : (s?.outletBar ?? fullBar) * ramp
        : passShare(ctx, state, n) > 0
          ? inlet
          : 0;
    valves[n.part] = { rate: q, flowing: q > 0, inletBar: inlet, outletBar: outlet };
  }
  return { source: supply.source, rate, supplyBar: fullBar * ramp, edges, valves, tanks };
}

/** Moves the valves, runs the flow and fills the tanks for dt seconds of clock time. */
export function stepFlow(state: FlowState, dt: number, ctx: FlowContext): FlowState {
  let position = state.position;
  for (const [tag, target] of Object.entries(state.commanded)) {
    const at = state.position[tag] ?? 0;
    if (at === target || state.faults[tag] === 'STUCK') continue;
    const step = (100 / travelSeconds(ctx.plant.components[tag]?.spec.operation)) * dt;
    if (position === state.position) position = { ...position };
    position[tag] = at < target ? Math.min(target, at + step) : Math.max(target, at - step);
  }
  let next: FlowState = { ...state, time: state.time + dt, position };

  const trace = traceFlow(ctx, next);
  if (trace.rate > 0) {
    const levels = { ...next.levels };
    for (const [tag, m3h] of Object.entries(trace.tanks)) {
      const cap = ctx.data.tanks[tag]?.capacityM3;
      if (cap) levels[tag] = Math.min(100, levels[tag] + ((m3h * dt * TIME_SCALE) / 3600 / cap) * 100);
    }
    next = { ...next, levels };
    // Like the tank's high-high alarm tripping the supply.
    const full = Object.keys(trace.tanks).find((tag) => levels[tag] >= (ctx.data.tanks[tag]?.highHighPct ?? 100));
    if (full) {
      next = { ...next, supply: null, message: `${full} reached its high-high level (${ctx.data.tanks[full].highHighPct} %): supply stopped` };
    }
  }
  return next;
}

/** Whether anything is still changing: a valve on its way, or the supply running. */
export const flowBusy = (state: FlowState) =>
  state.supply !== null || Object.entries(state.commanded).some(([t, c]) => state.position[t] !== c && state.faults[t] !== 'STUCK');

/** Each component's live state, in the shape of the source's simulation block. */
export function componentStates(ctx: FlowContext, state: FlowState, trace: FlowTrace): Record<string, ComponentState> {
  const out: Record<string, ComponentState> = {};
  for (const tag of Object.keys(ctx.plant.components)) {
    // Relief valves aren't worked, so they have no position: shut.
    const pos = state.position[tag] ?? 0;
    const cmd = state.commanded[tag] ?? pos;
    const moving = pos !== cmd && state.faults[tag] !== 'STUCK';
    const status = moving ? (cmd > pos ? 'OPENING' : 'CLOSING') : pos > 0 ? 'OPEN' : 'CLOSED';
    const f = trace.valves[tag];
    const flowing = f?.flowing === true;
    const fault = state.faults[tag];
    out[tag] = {
      status,
      positionPct: Math.round(pos),
      commandedPct: cmd,
      flowStatus: flowing ? 'FLOWING' : 'NO_FLOW',
      flowM3h: f?.rate ?? 0,
      inletBar: f?.inletBar ?? 0,
      outletBar: f?.outletBar ?? 0,
      fault: fault !== undefined,
      faultCode: fault ?? null,
      animation: moving ? (status as 'OPENING' | 'CLOSING') : flowing ? 'FLOWING' : 'IDLE',
      flowing,
    };
  }
  return out;
}

/** The section's data with the live valve positions, hose pressures and tank levels. */
export function liveData(base: SectionData, state: FlowState, trace: FlowTrace): SectionData {
  const map = <T, U>(o: Record<string, T>, f: (tag: string, v: T) => U) => Object.fromEntries(Object.entries(o).map(([t, v]) => [t, f(t, v)]));
  return {
    ...base,
    valves: map(base.valves, (t, v) => ({ ...v, open: t in state.position ? state.position[t] > 0 : v.open })),
    tanks: map(base.tanks, (t, v) => ({ ...v, levelPct: state.levels[t] ?? v.levelPct })),
    hoses: map(base.hoses, (t, v) => {
      const connected = state.hoses[t] ?? v.connected;
      return { ...v, connected, pressureBar: connected ? (trace.source === t ? trace.supplyBar : 0) : undefined };
    }),
  };
}

/** How fast the fuel front is drawn running along the pipes when the flow starts, diagram units per second. */
export const FRONT_SPEED = 260;

/** A run of one pipe with flow in it, from where the flow enters it, for drawing. */
export interface FlowRun {
  id: string;
  pipe: PipeDef;
  pts: Pt[];
  /** Distance from the source to the start of the run. */
  start: number;
}

/** The flowing pieces of pipe joined into runs along each pipe, in the direction of flow. */
export function flowRuns(trace: FlowTrace): FlowRun[] {
  const leaving = new Map<string, FlowEdge>();
  for (const fe of trace.edges) leaving.set(`${fe.edge.pipe.id}@${fe.from.id}`, fe);
  const continues = new Set(trace.edges.map((fe) => leaving.get(`${fe.edge.pipe.id}@${fe.to.id}`)).filter(Boolean));
  const runs: FlowRun[] = [];
  for (const first of trace.edges) {
    if (continues.has(first)) continue;
    const pts: Pt[] = [first.from.at];
    for (let fe: FlowEdge | undefined = first; fe; fe = leaving.get(`${fe.edge.pipe.id}@${fe.to.id}`)) pts.push(fe.to.at);
    runs.push({ id: `${first.edge.pipe.id}@${first.from.id}`, pipe: first.edge.pipe, pts, start: first.start });
  }
  return runs;
}
