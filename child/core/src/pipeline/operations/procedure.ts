import { VALVE_KINDS } from '../diagram/partSpecs';
import { isOperable, traceFlow, travelSeconds, type FlowContext, type FlowState } from './flow';
import { otherEnd, shortestPath, type NetNode } from './network';

/*
 * The procedure function. For a route (a manifold connection to a tank) it works out the line-up from
 * the drawing: the valves on the way, opened from the tank back to the connection, and the first valve
 * on every branch off the way, closed so the fuel goes nowhere else. Then the supply is started. The
 * stop procedure undoes it. A run carries the steps out one at a time and waits for each to finish.
 */

export interface Route {
  /** Manifold connection the fuel comes in through. */
  source: string;
  tank: string;
}

export type StepAction = 'connect' | 'close' | 'open' | 'start' | 'stop' | 'verify';

export interface ProcedureStep {
  action: StepAction;
  /** What it is done to: a valve, the manifold connection, or the receiving tank. */
  tag: string;
  text: string;
  /** What the part is, or why the step is there. */
  why: string;
}

export interface ProcedureRun {
  kind: 'start' | 'stop';
  route: Route;
  steps: ProcedureStep[];
  /** The step being worked on; steps.length once all are done. */
  index: number;
  /** When the current step was carried out (FlowState.time), or null while it is still to do. */
  appliedAt: number | null;
  /** Wait for carryOutStep() before each step, instead of going on by itself. */
  stepByStep: boolean;
  /** Why it stopped short, if it did. */
  failed: string | null;
}

const isRelief = (ctx: FlowContext, n: NetNode) => !!n.part && ctx.net.parts.get(n.part)?.kind === 'PSV';

/** The tanks a manifold connection can reach through the pipes, whatever the valves, in diagram order. */
export function reachableTanks(ctx: FlowContext, source: string): string[] {
  const root = ctx.net.nodeOf.get(source);
  if (!root) return [];
  const found = new Set<string>();
  const seen = new Set([root]);
  const stack = [root];
  while (stack.length) {
    const n = stack.pop()!;
    if (n.tank) found.add(n.tank);
    if (n !== root && (n.tank || isRelief(ctx, n))) continue;
    for (const e of n.edges) {
      const m = otherEnd(e, n);
      if (!seen.has(m)) {
        seen.add(m);
        stack.push(m);
      }
    }
  }
  return ctx.def.parts.filter((p) => found.has(p.tag)).map((p) => p.tag);
}

interface LineUp {
  /** Valves on the way, from the connection to the tank. */
  route: string[];
  /** The first valve on each branch off the way. */
  shut: string[];
  /** Gauge isolation valves among those, which are opened to read the line pressure instead. */
  gauge: string[];
  /** The gauge on the connection. */
  gaugeTag?: string;
}

function lineUp(ctx: FlowContext, route: Route): LineUp | null {
  const root = ctx.net.nodeOf.get(route.source);
  const path = root && shortestPath(root, (n) => n.tank === route.tank, (n) => !isRelief(ctx, n));
  if (!root || !path) return null;
  const nodes = [root];
  for (const e of path) nodes.push(otherEnd(e, nodes[nodes.length - 1]));
  const onPath = new Set(path);

  const branch: string[] = [];
  const seen = new Set<NetNode>(nodes);
  const walk = (n: NetNode) => {
    if (seen.has(n)) return;
    seen.add(n);
    const kind = n.part ? ctx.net.parts.get(n.part)?.kind : undefined;
    if (kind && VALVE_KINDS.has(kind)) {
      if (isOperable(ctx, n.part!)) branch.push(n.part!);
      return;
    }
    if (n.tank) return;
    for (const e of n.edges) walk(otherEnd(e, n));
  };
  for (const n of nodes) for (const e of n.edges) if (!onPath.has(e)) walk(otherEnd(e, n));

  const isolation = new Set(Object.values(ctx.data.gauges).map((g) => g.isolationValve));
  return {
    route: nodes.filter((n) => n.part && isOperable(ctx, n.part)).map((n) => n.part!),
    shut: branch.filter((t) => !isolation.has(t)),
    gauge: branch.filter((t) => isolation.has(t)),
    gaugeTag: Object.entries(ctx.data.gauges).find(([, g]) => g.hose === route.source)?.[0],
  };
}

const label = (ctx: FlowContext, tag: string) => {
  const id = ctx.plant.components[tag]?.id;
  return id && id !== tag ? `${tag} (${id})` : tag;
};
const nameOf = (ctx: FlowContext, tag: string) => ctx.net.parts.get(tag)?.name ?? tag;

/** The pump that drives the route's system, from its valves' related ids; the drawing doesn't show it. */
function pumpLabel(ctx: FlowContext, valves: string[]): string {
  const id = valves.flatMap((t) => ctx.plant.components[t]?.related ?? []).find((r) => r in ctx.plant.pumps);
  return id ? `${ctx.plant.pumps[id].name} (${id})` : 'the supply';
}

/** Steps to line up the route and start the flow, or null if the connection can't reach the tank. */
export function startProcedure(ctx: FlowContext, route: Route): ProcedureStep[] | null {
  const lu = lineUp(ctx, route);
  if (!lu) return null;
  return [
    { action: 'connect', tag: route.source, text: `Connect the hose at ${route.source}`, why: nameOf(ctx, route.source) },
    ...lu.shut.map((t): ProcedureStep => ({ action: 'close', tag: t, text: `Check ${label(ctx, t)} closed`, why: nameOf(ctx, t) })),
    ...lu.gauge.map((t): ProcedureStep => ({
      action: 'open',
      tag: t,
      text: `Open ${label(ctx, t)}`,
      why: lu.gaugeTag ? `${nameOf(ctx, t)}, for ${lu.gaugeTag}` : nameOf(ctx, t),
    })),
    // From the tank back to the connection, so the line is open before the fuel reaches it.
    ...[...lu.route].reverse().map((t): ProcedureStep => ({ action: 'open', tag: t, text: `Open ${label(ctx, t)}`, why: nameOf(ctx, t) })),
    { action: 'start', tag: route.source, text: `Start ${pumpLabel(ctx, lu.route)} slowly`, why: `Delivery through ${route.source}` },
    {
      action: 'verify',
      tag: route.tank,
      text: `Check flow into ${route.tank}`,
      why: lu.gaugeTag ? `Pressure on ${lu.gaugeTag}, level rising` : 'Level rising',
    },
  ];
}

/** Steps to stop the flow and shut the route, from the connection to the tank. */
export function stopProcedure(ctx: FlowContext, route: Route): ProcedureStep[] | null {
  const lu = lineUp(ctx, route);
  if (!lu) return null;
  return [
    { action: 'stop', tag: route.source, text: `Stop ${pumpLabel(ctx, lu.route)}`, why: `End of delivery through ${route.source}` },
    ...[...lu.route, ...lu.gauge].map((t): ProcedureStep => ({ action: 'close', tag: t, text: `Close ${label(ctx, t)}`, why: nameOf(ctx, t) })),
  ];
}

export function newRun(kind: ProcedureRun['kind'], route: Route, steps: ProcedureStep[], stepByStep: boolean): ProcedureRun {
  return { kind, route, steps, index: 0, appliedAt: null, stepByStep, failed: null };
}

/** Does the step to the plant: moves a valve, connects the hose, starts or stops the supply. */
export function applyStep(state: FlowState, step: ProcedureStep): FlowState {
  switch (step.action) {
    case 'connect':
      return { ...state, hoses: { ...state.hoses, [step.tag]: true } };
    case 'open':
    case 'close':
      return {
        ...state,
        commanded: { ...state.commanded, [step.tag]: step.action === 'open' ? 100 : 0 },
        commandedAt: { ...state.commandedAt, [step.tag]: state.time },
      };
    case 'start':
      return { ...state, supply: { source: step.tag, since: state.time }, message: null };
    case 'stop':
      return { ...state, supply: null };
    case 'verify':
      return state;
  }
}

/** Whether the plant shows the step done. */
export function stepDone(ctx: FlowContext, state: FlowState, step: ProcedureStep): boolean {
  switch (step.action) {
    case 'connect':
      return state.hoses[step.tag] === true;
    case 'open':
      return state.position[step.tag] === 100;
    case 'close':
      return state.position[step.tag] === 0;
    case 'start':
      return state.supply?.source === step.tag;
    case 'stop':
      return state.supply === null;
    case 'verify':
      return (traceFlow(ctx, state).tanks[step.tag] ?? 0) > 0;
  }
}

/** Seconds a step may take before the run gives up on it. */
function timeout(ctx: FlowContext, step: ProcedureStep): number {
  if (step.action === 'open' || step.action === 'close') return travelSeconds(ctx.plant.components[step.tag]?.spec.operation) + 2.5;
  return step.action === 'verify' ? 8 : 2;
}

function failure(ctx: FlowContext, state: FlowState, step: ProcedureStep): string {
  if (step.action === 'open' || step.action === 'close') {
    return `${label(ctx, step.tag)} didn't ${step.action}: it is at ${Math.round(state.position[step.tag] ?? 0)} %. See its troubleshooting.`;
  }
  if (step.action === 'verify') return `No flow into ${step.tag}. Check the line-up.`;
  return `${step.text}: not done.`;
}

/** Carries out the current step now (used for step by step). */
export function carryOutStep(ctx: FlowContext, run: ProcedureRun, state: FlowState): { run: ProcedureRun; state: FlowState } {
  if (run.failed || run.index >= run.steps.length || run.appliedAt !== null) return { run, state };
  const step = run.steps[run.index];
  const next = applyStep(state, step);
  return stepDone(ctx, next, step) ? { run: { ...run, index: run.index + 1 }, state: next } : { run: { ...run, appliedAt: next.time }, state: next };
}

/** Moves the run on: carries out the next step (unless step by step) and checks the one under way. */
export function advanceRun(ctx: FlowContext, run: ProcedureRun, state: FlowState): { run: ProcedureRun; state: FlowState } {
  if (run.failed || run.index >= run.steps.length) return { run, state };
  if (run.appliedAt === null) return run.stepByStep ? { run, state } : carryOutStep(ctx, run, state);
  const step = run.steps[run.index];
  if (stepDone(ctx, state, step)) return { run: { ...run, index: run.index + 1, appliedAt: null }, state };
  if (state.time - run.appliedAt > timeout(ctx, step)) return { run: { ...run, failed: failure(ctx, state, step) }, state };
  return { run, state };
}

/** Whether the run is still going by itself (not finished, failed or waiting for the next step). */
export const runActive = (run: ProcedureRun | null) =>
  !!run && !run.failed && run.index < run.steps.length && !(run.stepByStep && run.appliedAt === null);
