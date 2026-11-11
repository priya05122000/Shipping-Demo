import type { Reading } from '../data/readings';
import type { SectionData } from '../data/sectionData';
import { findObject } from '../../objects/lookup';
import { SYMBOL_KINDS, isBoxTank, kindLabel, onReferenceSheet, placementOf, refNumber, symbolBox } from '../diagram/partSpecs';
import { fluidInfo, type DiagramDef, type Fluid, type PartDef } from '../diagram/types';
import type { Operations } from '../operations/useOperations';
import { ComponentSections, FlowCard } from './OperationsPanel';
import { PartDefs, PartGlyph } from './Parts';
import { FLUID_STYLE, GAUGE, STATUS_COLOR, STEEL } from './theme';
import { Chip, FOCUS_RING, Rows, SECTION_TITLE } from './ui';

/** The overview's system cards, in this order. */
const CARD_ORDER: Fluid[] = ['FO', 'DO', 'TR', 'BK', 'RC'];

interface Props {
  def: DiagramDef;
  data: SectionData;
  readings: Record<string, Reading>;
  /** Flow, procedures and troubleshooting, for a section whose valves have component data. */
  ops: Operations | null;
  /** False while the panel's column is closed (or closing). */
  open: boolean;
  selected: string | null;
  onSelect: (tag: string | null) => void;
  onCloseOverview: () => void;
}

const HEADING = 'text-[16px] font-[650]';
const ICON_BUTTON = `size-[30px] flex-none cursor-pointer rounded-lg border border-line bg-panel-2 text-[18px] leading-none ${FOCUS_RING}`;
const PART_IMAGE = 'size-full max-h-full max-w-full object-contain';

export function InfoPanel({ def, data, readings, ops, open, selected, onSelect, onCloseOverview }: Props) {
  const part = def.parts.find((p) => p.tag === selected);
  return (
    // Closing, it is hidden once its column has slid shut. Below the wide breakpoint it sits under the diagram.
    <aside className={`min-w-0 overflow-hidden ${open ? '' : 'invisible [transition:visibility_0s_250ms] max-wide:hidden'}`}>
      {/* A fixed-width inner box, so the content slides out with the column instead of reflowing. */}
      <div className="h-full w-85 overflow-y-auto border-l border-line bg-panel p-4 max-wide:w-auto max-wide:border-t max-wide:border-l-0">
        {part ? (
          <PartDetails part={part} data={data} reading={readings[part.tag]} ops={ops} onClose={() => onSelect(null)} />
        ) : (
          <Overview def={def} data={data} readings={readings} ops={ops} onSelect={onSelect} onClose={onCloseOverview} />
        )}
      </div>
    </aside>
  );
}

function PartIcon({ part }: { part: PartDef }) {
  // Its Library object's 2D picture, as on the drawing.
  const picture = placementOf(part) && part.object ? findObject(part.object)?.lineDiagram : null;
  if (picture) return <img src={picture} alt="" className={PART_IMAGE} />;
  const box = symbolBox(part);
  if ((SYMBOL_KINDS.has(part.kind) || isBoxTank(part)) && box) {
    const pad = 2;
    return (
      <svg viewBox={`${box.x0 - pad} ${box.y0 - pad} ${box.x1 - box.x0 + pad * 2} ${box.y1 - box.y0 + pad * 2}`} className={PART_IMAGE} aria-hidden="true">
        <PartDefs />
        <PartGlyph part={{ ...part, at: [0, 0], rot: 0, flip: false }} />
      </svg>
    );
  }
  const color = FLUID_STYLE[part.fluid].rim;
  if (part.kind === 'PI') {
    return (
      <svg viewBox="-16 -16 32 32" className={PART_IMAGE} aria-hidden="true">
        <circle r={14} fill={GAUGE.bezelFlat} stroke={GAUGE.ink} />
        <circle r={11} fill={GAUGE.face} />
        <path d="M-1,1.5 L0,-9 L1,1.5 Z" fill={GAUGE.needle} transform="rotate(30)" />
        <circle r={1.6} fill={GAUGE.hub} />
      </svg>
    );
  }
  return (
    <svg viewBox="-16 -16 32 32" className={PART_IMAGE} aria-hidden="true">
      <rect x={-4} y={-2} width={8} height={18} fill={color} opacity={0.7} />
      <rect x={-12} y={-6} width={24} height={4} rx={1} fill={STEEL.mid} />
      <rect x={-12} y={-12} width={24} height={4} rx={1} fill={STEEL.dim} />
    </svg>
  );
}

function PartDetails({
  part,
  data,
  reading,
  ops,
  onClose,
}: {
  part: PartDef;
  data: SectionData;
  reading?: Reading;
  ops: Operations | null;
  onClose: () => void;
}) {
  const tank = data.tanks[part.tag];
  const id = ops?.plant.components[part.tag]?.id;

  return (
    <div>
      <div className="flex items-start gap-3">
        <div className="grid size-19 flex-none place-items-center rounded-xl border border-line bg-[radial-gradient(circle_at_40%_35%,var(--panel),var(--panel-2))] p-1.5">
          <PartIcon part={part} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] text-muted">
            #{refNumber(part)} · {kindLabel(part)}
          </div>
          <h2 className={`${HEADING} mt-0.5 mb-1.5 leading-tight`}>{part.name}</h2>
          <div className="flex flex-wrap gap-1.5">
            <Chip>{part.tag}</Chip>
            {id && id !== part.tag && <Chip>{id}</Chip>}
          </div>
        </div>
        <button className={ICON_BUTTON} onClick={onClose} aria-label="Close details">×</button>
      </div>

      {reading && (
        <div className="mt-4 flex items-center gap-2.5 font-mono text-[24px] font-bold" style={{ color: STATUS_COLOR[reading.status] }}>
          <span className="size-2.5 rounded-full bg-current shadow-[0_0_8px_currentColor]" />
          {reading.value}
        </div>
      )}

      {tank && reading?.num !== undefined && (
        <div className="relative mt-2.5 h-2.5 overflow-hidden rounded-[5px] bg-hover" aria-label={`Level ${reading.num.toFixed(1)} %`}>
          <div className="h-full rounded-[5px] transition-[width] duration-900" style={{ width: `${reading.num}%`, background: FLUID_STYLE[part.fluid].liquid }} />
          <div className="absolute inset-y-0 w-0.5 bg-warn" style={{ left: `${tank.highPct}%` }} title={`High level ${tank.highPct} %`} />
          <div className="absolute inset-y-0 w-0.5 bg-alarm" style={{ left: `${tank.highHighPct}%` }} title={`High-high level ${tank.highHighPct} %`} />
        </div>
      )}

      {reading && (
        <section>
          <h3 className={SECTION_TITLE}>Values</h3>
          <Rows rows={reading.rows} />
        </section>
      )}

      <section>
        <h3 className={SECTION_TITLE}>Details</h3>
        <Rows
          rows={[
            ['Line', part.line],
            ['Area', part.area],
            ...(tank ? ([['Capacity', `${tank.capacityM3} m³`]] as [string, string][]) : []),
            ...(onReferenceSheet(part) ? ([['Reference sheet', `Item ${refNumber(part)}`]] as [string, string][]) : []),
          ]}
        />
      </section>

      {ops && <ComponentSections part={part} ops={ops} />}
    </div>
  );
}

function Overview({
  def,
  data,
  readings,
  ops,
  onSelect,
  onClose,
}: {
  def: DiagramDef;
  data: SectionData;
  readings: Record<string, Reading>;
  ops: Operations | null;
  onSelect: (tag: string) => void;
  onClose: () => void;
}) {
  const alarms = def.parts.filter((p) => ['warn', 'alarm'].includes(readings[p.tag]?.status));
  const equipment = def.parts.filter((p) => p.kind === 'PU' || p.kind === 'FL');
  // A card for each fluid with hose connections or tanks.
  const cards = CARD_ORDER.filter((f) => def.parts.some((p) => p.fluid === f && (p.kind === 'MC' || p.kind === 'TK')));
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className={HEADING}>System overview</h2>
        <button className={ICON_BUTTON} onClick={onClose} aria-label="Close overview" title="Close overview">×</button>
      </div>
      <p className="my-3 text-[12px] text-muted">
        {ops ? "Values from the drawing and the section's manual, live while valves move and fuel flows" : "Values from the drawing and the section's manual"}
      </p>
      {ops && <FlowCard ops={ops} def={def} onSelect={onSelect} />}
      {cards.map((fluid) => {
        const style = FLUID_STYLE[fluid];
        const hasHoses = def.parts.some((p) => p.kind === 'MC' && p.fluid === fluid);
        const mc = def.parts.find((p) => p.kind === 'MC' && p.fluid === fluid && data.hoses[p.tag]?.connected);
        const hose = mc ? data.hoses[mc.tag] : undefined;
        const tanks = def.parts.filter((p) => p.kind === 'TK' && p.fluid === fluid);
        return (
          <div className="mt-3.5 rounded-xl border bg-panel-2 p-3" key={fluid} style={{ borderColor: style.rim + '55' }}>
            <div className="flex items-center gap-2">
              <span className="size-3 rounded-[3px]" style={{ background: style.liquid }} />
              <strong>{fluidInfo(def, fluid).name} system</strong>
            </div>
            {hasHoses && (
              <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                <Stat label="Pressure" value={hose ? (hose.pressureBar ?? 0).toFixed(2) : '—'} unit="bar" />
                <Stat label="Temp" value={hose ? (hose.tempC ?? 0).toFixed(1) : '—'} unit="°C" />
              </div>
            )}
            {mc && (
              <button className="mt-2 cursor-pointer text-[12px] text-accent" onClick={() => onSelect(mc.tag)}>
                via {mc.tag}
              </button>
            )}
            <ul className="mt-2.5">
              {tanks.map((t) => {
                const r = readings[t.tag];
                const level = r?.num ?? 0;
                return (
                  <li key={t.tag}>
                    {/* On the gray-violet card, so it lights up white. */}
                    <button
                      className="grid w-full cursor-pointer grid-cols-[62px_1fr_52px] items-center gap-2 rounded-md px-1 py-1.25 text-[12px] hover:bg-panel"
                      onClick={() => onSelect(t.tag)}
                    >
                      <span className="text-left font-mono">{t.tag}</span>
                      <span className="h-1.5 overflow-hidden rounded-[3px] bg-panel">
                        <span className="block h-full transition-[width] duration-900" style={{ width: `${level}%`, background: style.liquid }} />
                      </span>
                      <span className="text-right font-mono tabular-nums" style={{ color: STATUS_COLOR[r?.status ?? 'ok'] }}>
                        {level.toFixed(1)}%
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}

      {equipment.length > 0 && (
        <section>
          <h3 className={SECTION_TITLE}>Equipment</h3>
          <ul>
            {equipment.map((p) => {
              const r = readings[p.tag];
              return (
                <li key={p.tag}>
                  <button
                    className="grid w-full cursor-pointer grid-cols-[52px_1fr_auto] items-center gap-2 rounded-md px-1 py-1.25 text-left text-[12px] hover:bg-hover"
                    onClick={() => onSelect(p.tag)}
                  >
                    <span className="font-mono">{p.tag}</span>
                    <span className="truncate text-muted">{p.name}</span>
                    <span className="font-mono tabular-nums" style={{ color: STATUS_COLOR[r?.status ?? 'idle'] }}>
                      {r?.value ?? '—'}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section>
        <h3 className={SECTION_TITLE}>
          Alarms {alarms.length > 0 && <span className="rounded-full bg-warn px-1.5 text-[10px] text-on-accent">{alarms.length}</span>}
        </h3>
        {alarms.length === 0 ? (
          <p className="my-3 text-[12px] text-muted">No active alarms</p>
        ) : (
          <ul>
            {alarms.map((p) => (
              <li key={p.tag}>
                <button
                  onClick={() => onSelect(p.tag)}
                  className={`mb-1.5 w-full cursor-pointer rounded-lg border px-2.5 py-1.75 text-left text-[12px] ${
                    readings[p.tag].status === 'alarm' ? 'border-alarm/45 bg-alarm/8 text-alarm' : 'border-warn/40 bg-warn/8 text-warn'
                  }`}
                >
                  <strong>{p.tag}</strong> {readings[p.tag].alarm ?? 'Alarm'} · {readings[p.tag].value}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] tracking-[0.5px] text-muted uppercase">{label}</span>
      <span className="font-mono text-[14px] font-[650] tabular-nums">
        {value}
        <small className="text-[10px] font-medium text-muted"> {unit}</small>
      </span>
    </div>
  );
}
