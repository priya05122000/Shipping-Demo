import { travelSeconds, type FaultKind, type FlowState } from './flow';
import type { ComponentData, ComponentState, Plant, TroubleshootingGuide } from './types';

/*
 * The troubleshooting function. It reads a component's live values the way an operator would, names the
 * symptoms it sees, and pairs them with the component's guide from manual-data.json. Faults can be
 * put on a valve to try it out; the symptoms then come from how the faulty valve behaves, not from the label.
 */

export interface Troubleshooting {
  component: ComponentData;
  guide?: TroubleshootingGuide;
  /** Symptoms seen in the live values, worded for the operator. */
  findings: string[];
  /** The fault put on the valve to try troubleshooting, if any. */
  fault: FaultKind | null;
}

/** Symptoms the live values show. */
export function diagnose(tag: string, component: ComponentData, live: ComponentState, state: FlowState): string[] {
  const found: string[] = [];
  const moving = live.status === 'OPENING' || live.status === 'CLOSING';
  const since = state.time - (state.commandedAt[tag] ?? 0);
  if (!moving && live.commandedPct !== live.positionPct && since > travelSeconds(component.spec.operation) + 0.5) {
    found.push(`Doesn't reach its commanded position: set to ${live.commandedPct} %, at ${live.positionPct} %`);
  }
  if (!moving && live.positionPct === 0 && live.flowM3h > 0.05) {
    found.push(`Flow through it while closed: ${live.flowM3h.toFixed(1)} m³/h`);
  }
  const design = component.spec.inletBar - component.spec.outletBar;
  const drop = live.inletBar - live.outletBar;
  if (live.flowing && drop > Math.max(2 * design, design + 0.3)) {
    found.push(`Pressure drop of ${drop.toFixed(2)} bar across it; design is ${design.toFixed(2)} bar`);
  }
  return found;
}

/** Everything about troubleshooting one component, or null if the part has no component data. */
export function troubleshoot(plant: Plant, tag: string, live: Record<string, ComponentState>, state: FlowState): Troubleshooting | null {
  const component = plant.components[tag];
  if (!component) return null;
  return {
    component,
    // The component's own guide (from its manual-data.json record), else one for its valve type.
    guide: plant.troubleshooting[component.id] ?? plant.troubleshooting[component.type],
    findings: live[tag] ? diagnose(tag, component, live[tag], state) : [],
    fault: state.faults[tag] ?? null,
  };
}

/** Findings for every component that has any. */
export function diagnoseAll(plant: Plant, live: Record<string, ComponentState>, state: FlowState): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [tag, component] of Object.entries(plant.components)) {
    const found = live[tag] ? diagnose(tag, component, live[tag], state) : [];
    if (found.length) out[tag] = found;
  }
  return out;
}

/** Puts a fault on a valve, or clears it (null). A cleared stuck valve goes on to where it was told. */
export function setFault(state: FlowState, tag: string, fault: FaultKind | null): FlowState {
  const faults = { ...state.faults };
  if (fault) faults[tag] = fault;
  else delete faults[tag];
  return { ...state, faults };
}
