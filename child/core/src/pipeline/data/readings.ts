import { VALVE_KINDS } from '../model/partSpecs';
import { fluidInfo, type DiagramDef, type PartDef } from '../model/types';
import type { ComponentState } from '../simulation/types';
import type { SectionData } from './sectionData';

/** open is also a running pump: both show green. */
export type Status = 'open' | 'closed' | 'idle' | 'ok' | 'warn' | 'alarm';

export interface Reading {
  status: Status;
  /** Short text for the on-diagram callout. */
  value: string;
  /** Main number: tank level (%) or gauge pressure (bar). */
  num?: number;
  rows: [string, string][];
  /** What the overview's alarm list says while the status is warn or alarm. */
  alarm?: string;
}

/** What the flow function adds while a section whose valves have component data is open. */
export interface LiveValues {
  /** Each component's live state, by tag. */
  components: Record<string, ComponentState>;
  /** Symptoms troubleshooting sees, by tag; these show as warnings. */
  findings: Record<string, string[]>;
  /** Flow into each receiving tank, m³/h. */
  tankInflow: Record<string, number>;
  /** The manifold connection being supplied. */
  supply: string | null;
}

const f0 = (n: number) => n.toFixed(0);
const f1 = (n: number) => n.toFixed(1);
const f2 = (n: number) => n.toFixed(2);
const fluidName = (def: DiagramDef, p: PartDef) => fluidInfo(def, p.fluid).full;
const STATE_TEXT = { OPEN: 'Open', CLOSED: 'Closed', OPENING: 'Opening', CLOSING: 'Closing' } as const;

/** A valve with a live state: where it is, and what flows through it. */
function liveValve(c: ComponentState): Reading {
  const moving = c.status === 'OPENING' || c.status === 'CLOSING';
  return {
    status: c.positionPct > 0 ? 'open' : 'closed',
    value: moving ? `${c.status} ${f0(c.positionPct)} %` : c.flowing ? `OPEN · ${f1(c.flowM3h)} m³/h` : c.status,
    rows: [
      ['State', STATE_TEXT[c.status]],
      ['Position', `${f0(c.positionPct)} %`],
      ...(c.commandedPct !== c.positionPct ? ([['Set to', `${f0(c.commandedPct)} %`]] as [string, string][]) : []),
      ['Flow', c.flowing ? `${f1(c.flowM3h)} m³/h` : 'No flow'],
      ['Inlet pressure', `${f2(c.inletBar)} bar`],
      ['Outlet pressure', `${f2(c.outletBar)} bar`],
    ],
  };
}

/** Readings for every part that has one. Dismantling joints have none. */
export function computeReadings(def: DiagramDef, data: SectionData, live?: LiveValues): Record<string, Reading> {
  const out: Record<string, Reading> = {};
  const isOpen = (tag: string) => data.valves[tag]?.open === true;
  const valveRow = (label: string, tag: string | undefined): [string, string] => [label, tag ? `${tag} (${isOpen(tag) ? 'open' : 'closed'})` : '—'];

  for (const p of def.parts) {
    const c = live?.components[p.tag];
    if (c && p.kind !== 'PSV' && VALVE_KINDS.has(p.kind)) {
      out[p.tag] = liveValve(c);
    } else if (p.kind === 'PSV') {
      const psv = data.reliefValves[p.tag];
      const setText = psv === undefined ? '—' : `${f1(psv.setPressureBar)} bar`;
      out[p.tag] = {
        status: 'closed',
        value: `SET ${setText}`,
        rows: [
          ['State', 'Seated (not relieving)'],
          ['Set pressure', setText],
          ...(psv?.protects ? ([['Protects', psv.protects]] as [string, string][]) : []),
        ],
      };
    } else if (VALVE_KINDS.has(p.kind)) {
      const open = isOpen(p.tag);
      out[p.tag] = {
        status: open ? 'open' : 'closed',
        value: open ? 'OPEN' : 'CLOSED',
        rows:
          p.kind === 'NRV'
            ? [
                ['State', open ? 'Open, passing flow' : 'Closed (seated)'],
                ['Action', 'Non-return: one way only'],
              ]
            : [
                ['State', open ? 'Open' : 'Closed'],
                ['Position', open ? '100 %' : '0 %'],
              ],
      };
    } else if (p.kind === 'TK') {
      const tank = data.tanks[p.tag];
      const level = tank?.levelPct ?? 0;
      const cap = tank?.capacityM3 ?? 0;
      const vol = (level / 100) * cap;
      const status = tank && level >= tank.highHighPct ? 'alarm' : tank && level >= tank.highPct ? 'warn' : 'ok';
      const inflow = live?.tankInflow[p.tag] ?? 0;
      out[p.tag] = {
        status,
        value: `${f1(level)} % · ${f0(vol)} m³`,
        num: level,
        alarm: status === 'alarm' ? 'High-high level' : 'High level',
        rows: [
          ...(inflow > 0 ? ([['Filling', `${f1(inflow)} m³/h`]] as [string, string][]) : []),
          ['Level', `${f1(level)} %`],
          ['Volume', `${f0(vol)} / ${cap} m³`],
          ['Ullage', `${f0(cap - vol)} m³`],
          ['Temperature', `${f1(tank?.tempC ?? 0)} °C`],
          // A supply tank with only an outlet valve shows that instead of the inlet.
          ...(tank?.outletValve ? [valveRow('Outlet valve', tank.outletValve)] : []),
          ...(tank?.outletValve && !tank.inletValve ? [] : [valveRow('Inlet valve', tank?.inletValve)]),
        ],
      };
    } else if (p.kind === 'PI') {
      const gauge = data.gauges[p.tag];
      const hose = gauge ? data.hoses[gauge.hose] : undefined;
      const isolation = gauge?.isolationValve;
      const isolated = isolation ? !isOpen(isolation) : false;
      const bar = isolated || !hose?.connected ? 0 : hose.pressureBar ?? 0;
      out[p.tag] = {
        status: gauge && bar > gauge.highBar ? 'warn' : bar > 0.2 ? 'ok' : 'idle',
        value: `${f2(bar)} bar`,
        num: bar,
        alarm: 'High pressure',
        rows: [
          ['Pressure', `${f2(bar)} bar`],
          ['Range', gauge ? `0 – ${gauge.maxBar} bar` : '—'],
          ...(isolation ? ([['Isolation valve', `${isolation} (${isolated ? 'closed' : 'open'})`]] as [string, string][]) : []),
        ],
      };
    } else if (p.kind === 'MC') {
      const hose = data.hoses[p.tag];
      const connected = hose?.connected === true;
      const delivering = connected && live?.supply === p.tag;
      out[p.tag] = {
        status: delivering ? 'open' : connected ? 'ok' : 'idle',
        value: delivering ? 'DELIVERING' : connected ? 'HOSE ON' : 'BLANKED',
        rows: [
          ['Hose', delivering ? 'Connected, delivering' : connected ? 'Connected' : 'Blank flange fitted'],
          ['Pressure', connected ? `${f2(hose.pressureBar ?? 0)} bar` : '—'],
          ['Temperature', connected ? `${f1(hose.tempC ?? 0)} °C` : '—'],
        ],
      };
    } else if (p.kind === 'PU') {
      const pump = data.pumps[p.tag];
      const running = pump?.running === true;
      out[p.tag] = {
        status: running ? 'open' : 'idle',
        value: running ? `RUNNING · ${f1(pump.dischargeBar ?? 0)} bar` : 'STOPPED',
        rows: [
          ['State', running ? 'Running' : 'Stopped (standby)'],
          ['Discharge', running ? `${f2(pump.dischargeBar ?? 0)} bar` : '—'],
          ['Suction', running ? `${f2(pump.suctionBar ?? 0)} bar` : '—'],
          ['Rated capacity', pump ? `${pump.ratedM3h} m³/h` : '—'],
        ],
      };
    } else if (p.kind === 'FL') {
      const filter = data.filters[p.tag];
      const inService = filter?.inService === true;
      const dp = inService ? filter.dpBar ?? 0 : 0;
      out[p.tag] = {
        status: !inService ? 'idle' : dp >= filter.dpHighBar ? 'warn' : 'ok',
        value: inService ? `ΔP ${f2(dp)} bar` : 'STANDBY',
        alarm: 'High ΔP, needs cleaning',
        rows: [
          ['State', inService ? 'In service' : 'Standby'],
          ['Pressure drop', inService ? `${f2(dp)} bar` : '—'],
          ['Clean at', filter ? `${f1(filter.dpHighBar)} bar ΔP` : '—'],
        ],
      };
    }
    const reading = out[p.tag];
    reading?.rows.push(['Fluid', fluidName(def, p)]);
    const findings = live?.findings[p.tag];
    if (reading && findings?.length) Object.assign(reading, { status: 'warn', alarm: findings[0] });
  }
  return out;
}
