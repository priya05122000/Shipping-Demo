import { useCallback, useEffect, useMemo } from 'react';
import { useSectionState } from '../../shared/diagram/context';
import type { LiveValues } from '../data/readings';
import { plantOf, type SectionData } from '../data/sectionData';
import type { DiagramDef } from '../diagram/types';
import {
  componentStates,
  flowBusy,
  flowRuns,
  initialFlowState,
  liveData,
  stepFlow,
  traceFlow,
  type FaultKind,
  type FlowContext,
  type FlowRun,
  type FlowState,
  type FlowTrace,
} from './flow';
import { buildNetwork } from './network';
import { advanceRun, carryOutStep, newRun, reachableTanks, runActive, startProcedure, stopProcedure, type ProcedureRun, type Route } from './procedure';
import { diagnoseAll, setFault as withFault, troubleshoot as troubleshootPart, type Troubleshooting } from './troubleshooting';
import type { Plant } from './types';

/** How often the plant is moved on while something is changing, ms. */
const TICK_MS = 250;

interface Sim {
  flow: FlowState;
  run: ProcedureRun | null;
}

/** A section's flow, procedures and troubleshooting, for the views and the info panel. */
export interface Operations {
  /** The components (from manual-data.json) by tag, with the systems and guides they refer to. */
  plant: Plant;
  /** The section's data with the live valve positions, hose pressures and tank levels. */
  data: SectionData;
  live: LiveValues;
  trace: FlowTrace;
  /** The pipes with flow in them, for drawing. */
  runs: FlowRun[];
  flow: FlowState;
  run: ProcedureRun | null;
  route: Route;
  /** Manifold connections that reach a tank, and the tanks each reaches. */
  sources: string[];
  tanksFor(source: string): string[];
  setRoute(route: Route): void;
  stepByStep: boolean;
  setStepByStep(on: boolean): void;
  /** Runs the start procedure for the route: line-up, then the supply. */
  startFlow(): void;
  /** Runs the stop procedure for the route last started (or the chosen one). */
  stopFlow(): void;
  /** Step by step: carries out the next step. */
  nextStep(): void;
  troubleshoot(tag: string): Troubleshooting | null;
  setFault(tag: string, fault: FaultKind | null): void;
}

function tick(ctx: FlowContext, sim: Sim, dt: number): Sim {
  const flow = stepFlow(sim.flow, dt, ctx);
  if (!sim.run) return { flow, run: null };
  const { run, state } = advanceRun(ctx, sim.run, flow);
  return { flow: state, run };
}

/**
 * Null for a section whose valves have no component data: its values stay as they start. The plant's state is kept
 * for the section (useSectionState), so a flow started in one view goes on in the other.
 */
export function useOperations(def: DiagramDef, data: SectionData): Operations | null {
  const plant = useMemo(() => plantOf(data), [data]);
  const ctx = useMemo<FlowContext | null>(() => (plant ? { def, net: buildNetwork(def), data, plant } : null), [def, data, plant]);
  const key = `pipeline:${def.id}`;
  const [sim, setSim] = useSectionState<Sim | null>(`${key}:sim`, () => (ctx ? { flow: initialFlowState(ctx), run: null } : null));
  const [stepByStep, setStepByStepState] = useSectionState(`${key}:step-by-step`, false);

  const sources = useMemo(
    () => (ctx ? def.parts.filter((p) => p.kind === 'MC' && reachableTanks(ctx, p.tag).length > 0).map((p) => p.tag) : []),
    [ctx, def],
  );
  const tanksFor = useCallback((source: string) => (ctx ? reachableTanks(ctx, source) : []), [ctx]);
  const [route, setRoute] = useSectionState<Route>(`${key}:route`, () => {
    const source = sources.find((s) => data.hoses[s]?.connected) ?? sources[0] ?? '';
    return { source, tank: tanksFor(source)[0] ?? '' };
  });

  // Move the plant on while a valve travels, the supply runs or a procedure is going.
  const busy = !!sim && (flowBusy(sim.flow) || runActive(sim.run));
  useEffect(() => {
    if (!busy || !ctx) return;
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      const dt = Math.min(1, (now - last) / 1000);
      last = now;
      setSim((s) => s && tick(ctx, s, dt));
    }, TICK_MS);
    return () => clearInterval(id);
  }, [busy, ctx]);

  const flow = sim?.flow;
  const trace = useMemo(() => (ctx && flow ? traceFlow(ctx, flow) : null), [ctx, flow]);
  const components = useMemo(() => (ctx && flow && trace ? componentStates(ctx, flow, trace) : {}), [ctx, flow, trace]);
  const live = useMemo<LiveValues | null>(
    () =>
      plant && flow && trace
        ? { components, findings: diagnoseAll(plant, components, flow), tankInflow: trace.tanks, supply: trace.source }
        : null,
    [plant, flow, trace, components],
  );
  const liveSection = useMemo(() => (flow && trace ? liveData(data, flow, trace) : data), [data, flow, trace]);
  const runs = useMemo(() => (trace ? flowRuns(trace) : []), [trace]);

  const startFlow = useCallback(() => {
    if (!ctx) return;
    const steps = startProcedure(ctx, route);
    if (steps) setSim((s) => s && { ...s, run: newRun('start', route, steps, stepByStep) });
  }, [ctx, route, stepByStep]);

  const stopFlow = useCallback(() => {
    if (!ctx) return;
    setSim((s) => {
      if (!s) return s;
      const r = s.run?.route ?? route;
      const steps = stopProcedure(ctx, r);
      return steps ? { ...s, run: newRun('stop', r, steps, stepByStep) } : s;
    });
  }, [ctx, route, stepByStep]);

  const nextStep = useCallback(() => {
    if (!ctx) return;
    setSim((s) => {
      if (!s?.run) return s;
      const { run, state } = carryOutStep(ctx, s.run, s.flow);
      return { flow: state, run };
    });
  }, [ctx]);

  const setStepByStep = useCallback(
    (on: boolean) => {
      setStepByStepState(on);
      setSim((s) => s && (s.run ? { ...s, run: { ...s.run, stepByStep: on } } : s));
    },
    [setSim, setStepByStepState],
  );

  const setFault = useCallback(
    (tag: string, fault: FaultKind | null) => setSim((s) => s && { ...s, flow: withFault(s.flow, tag, fault) }),
    [setSim],
  );

  if (!ctx || !sim || !trace || !live || !plant) return null;
  return {
    plant,
    data: liveSection,
    live,
    trace,
    runs,
    flow: sim.flow,
    run: sim.run,
    route,
    sources,
    tanksFor,
    setRoute,
    stepByStep,
    setStepByStep,
    startFlow,
    stopFlow,
    nextStep,
    troubleshoot: (tag) => troubleshootPart(plant, tag, components, sim.flow),
    setFault,
  };
}
