import { useEffect, useRef } from 'react';
import type { DiagramDef, PartDef } from '../diagram/types';
import { FAULTS, TIME_SCALE, type FaultKind } from '../operations/flow';
import type { ProcedureRun } from '../operations/procedure';
import type { ComponentPipe, TroubleshootingGuide } from '../operations/types';
import type { Operations } from '../operations/useOperations';
import { FOCUS_RING, Rows, SECTION_TITLE } from './ui';

const SELECT = `w-full min-w-0 cursor-pointer rounded-md border border-line bg-panel px-1.5 py-1 text-[12px] text-ink disabled:cursor-default disabled:opacity-60 ${FOCUS_RING}`;
const BUTTON = `cursor-pointer rounded-lg px-3 py-1.5 text-[12px] font-[650] disabled:cursor-default disabled:opacity-40 ${FOCUS_RING}`;
const WARN_BOX = 'rounded-lg border border-warn/40 bg-warn/8 px-2.5 py-1.75 text-[12px] text-warn';

/** "BALL VALVE" → "Ball valve". */
const sentenceCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

/**
 * The overview's flow card: choose where the fuel comes in and which tank it goes to, start or stop the
 * flow, and follow the procedure as it is carried out. Each step selects its part on the diagram.
 */
export function FlowCard({ ops, def, onSelect }: { ops: Operations; def: DiagramDef; onSelect: (tag: string) => void }) {
  const { run, flow, trace, route } = ops;
  const name = (tag: string) => def.parts.find((p) => p.tag === tag)?.name ?? tag;
  const going = !!run && !run.failed && run.index < run.steps.length;
  const waiting = going && run.stepByStep && run.appliedAt === null;
  const locked = going || flow.supply !== null;

  let status: { text: string; warn?: boolean };
  if (run?.failed) status = { text: run.failed, warn: true };
  else if (going) status = { text: `${run.kind === 'start' ? 'Starting' : 'Stopping'}: step ${run.index + 1} of ${run.steps.length}${waiting ? '. Press Next step.' : ''}` };
  else if (trace.rate > 0) status = { text: `Flowing ${trace.rate.toFixed(1)} m³/h into ${Object.keys(trace.tanks).join(', ')}` };
  else if (flow.supply) status = { text: `Supply on at ${flow.supply.source}, but no flow`, warn: true };
  else if (flow.message) status = { text: flow.message, warn: true };
  else status = { text: 'No flow' };

  return (
    <div className="mt-3.5 rounded-xl border border-line bg-panel-2 p-3">
      <strong>{def.flowTitle ?? 'Flow'}</strong>
      <div className="mt-2.5 grid grid-cols-[34px_1fr] items-center gap-x-2 gap-y-1.5 text-[12px]">
        <label htmlFor="flow-from" className="text-muted">From</label>
        <select
          id="flow-from"
          className={SELECT}
          value={route.source}
          disabled={locked}
          onChange={(e) => ops.setRoute({ source: e.target.value, tank: ops.tanksFor(e.target.value)[0] ?? '' })}
        >
          {ops.sources.map((s) => (
            <option key={s} value={s}>
              {s} · {name(s)}
            </option>
          ))}
        </select>
        <label htmlFor="flow-to" className="text-muted">To</label>
        <select id="flow-to" className={SELECT} value={route.tank} disabled={locked} onChange={(e) => ops.setRoute({ ...route, tank: e.target.value })}>
          {ops.tanksFor(route.source).map((t) => (
            <option key={t} value={t}>
              {t} · {name(t)}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <button className={`${BUTTON} bg-accent text-on-accent`} disabled={locked || !route.tank} onClick={ops.startFlow}>
          Start flow
        </button>
        <button
          className={`${BUTTON} border border-line bg-panel text-ink hover:border-accent`}
          disabled={!flow.supply && run?.kind !== 'start'}
          onClick={ops.stopFlow}
        >
          Stop flow
        </button>
        <label className="ml-auto inline-flex cursor-pointer items-center gap-1.5 text-[12px] text-muted">
          <input type="checkbox" className="accent-accent" checked={ops.stepByStep} onChange={(e) => ops.setStepByStep(e.target.checked)} />
          Step by step
        </label>
      </div>

      <p className={`mt-2.5 text-[12px] ${status.warn ? 'text-warn' : 'text-muted'}`} role="status">
        {status.text}
      </p>
      {trace.rate > 0 && <p className="mt-0.5 text-[11px] text-muted">Tank levels rise {TIME_SCALE}× faster than real time.</p>}

      {run && <StepList run={run} ops={ops} onSelect={onSelect} />}
      {waiting && (
        <button className={`${BUTTON} mt-2 bg-accent text-on-accent`} onClick={ops.nextStep}>
          Next step
        </button>
      )}
    </div>
  );
}

function StepList({ run, ops, onSelect }: { run: ProcedureRun; ops: Operations; onSelect: (tag: string) => void }) {
  const listRef = useRef<HTMLOListElement>(null);

  // Keep the current step in view inside the list.
  useEffect(() => {
    const list = listRef.current;
    const el = list?.children[Math.min(run.index, run.steps.length - 1)] as HTMLElement | undefined;
    if (!list || !el) return;
    if (el.offsetTop < list.scrollTop || el.offsetTop + el.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = el.offsetTop - list.clientHeight / 2 + el.offsetHeight / 2;
    }
  }, [run.index, run.steps.length]);

  return (
    <section>
      <h3 className={SECTION_TITLE}>{run.kind === 'start' ? 'Start procedure' : 'Stop procedure'}</h3>
      <ol ref={listRef} className="relative max-h-72 overflow-y-auto text-[12px]">
        {run.steps.map((step, i) => {
          const done = i < run.index;
          const current = i === run.index;
          const failed = current && !!run.failed;
          const valve = ops.live.components[step.tag];
          const moving = current && valve && (valve.status === 'OPENING' || valve.status === 'CLOSING');
          return (
            <li key={i}>
              <button
                className={`grid w-full cursor-pointer grid-cols-[22px_1fr] gap-1 rounded-md px-1 py-1 text-left hover:bg-panel ${current ? 'bg-panel' : ''}`}
                onClick={() => onSelect(step.tag)}
              >
                <span
                  className={`font-mono font-bold ${failed ? 'text-warn' : done ? 'text-open' : current ? 'text-accent' : 'text-muted'}`}
                  aria-label={failed ? 'Failed' : done ? 'Done' : current ? 'Current step' : undefined}
                >
                  {failed ? '!' : done ? '✓' : current ? '›' : i + 1}
                </span>
                <span className={done ? 'text-muted' : ''}>
                  {step.text}
                  {moving && <span className="font-mono text-muted"> · {valve.positionPct} %</span>}
                  <span className="block text-[11px] text-muted">{step.why}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/**
 * A valve's component data from manual-data.json and its troubleshooting: the symptoms seen in its live
 * values, the guide for its type, and a fault that can be put on it to try it out.
 */
export function ComponentSections({ part, ops }: { part: PartDef; ops: Operations }) {
  const plant = ops.plant;
  const t = ops.troubleshoot(part.tag);
  // A tank isn't a component, but belongs to one of the systems' tanks.
  if (!t) {
    const group = Object.entries(plant.tanks).find(([, g]) => g.tags.includes(part.tag));
    if (!group) return null;
    const [id, g] = group;
    const valves = Object.values(plant.components).filter((c) => c.related.includes(id)).length;
    return (
      <section>
        <h3 className={SECTION_TITLE}>System</h3>
        <Rows rows={[['Tank group', `${id} · ${g.name}`], ['Valves', `${valves}`]]} />
        <p className="mt-2 text-[12px] text-muted">{g.system}</p>
      </section>
    );
  }

  const { component: c, guide, findings, fault } = t;
  const pipe = (p: ComponentPipe) => `${p.id} · ${p.pipe ? `${p.pipe}, ${p.line}` : 'open end'}`;
  const related = c.related.map((id) => `${id}${plant.tanks[id] ? ` (${plant.tanks[id].name})` : plant.pumps[id] ? ` (${plant.pumps[id].name})` : ''}`);
  const canFault = part.kind !== 'PSV';

  return (
    <>
      <section>
        <h3 className={SECTION_TITLE}>Component</h3>
        <Rows
          rows={[
            ['Valve no.', c.id],
            ['Type', sentenceCase(c.type)],
            ['Size', `DN${c.spec.sizeDN}`],
            ['Pressure rating', `${c.spec.pressureRatingBar} bar`],
            ['Operation', c.spec.operation],
            ['Connection', c.spec.connection],
            ['Rated flow', `${c.spec.ratedFlowM3h} m³/h`],
            ['Design pressure', `${c.spec.inletBar.toFixed(1)} → ${c.spec.outletBar.toFixed(1)} bar`],
            ['Inlet pipe', pipe(c.pipes.in)],
            ['Outlet pipe', pipe(c.pipes.out)],
          ]}
        />
        <p className="mt-2 text-[12px]">{c.spec.material}</p>
        <p className="mt-1.5 text-[12px] text-muted">{c.usecase}</p>
        <p className="mt-1.5 text-[12px] text-muted">
          {c.location} · {related.join(', ')}
        </p>
      </section>

      <section>
        <h3 className={SECTION_TITLE}>
          Troubleshooting {findings.length > 0 && <span className="rounded-full bg-warn px-1.5 text-[10px] text-on-accent">{findings.length}</span>}
        </h3>
        {findings.map((f) => (
          <p key={f} className={`mb-1.5 ${WARN_BOX}`}>
            {f}
          </p>
        ))}
        {findings.length === 0 && (
          <p className="text-[12px] text-muted">{fault ? 'Nothing shows yet: the fault shows when the valve is used or fuel reaches it.' : 'Nothing wrong in its values.'}</p>
        )}
        {guide && <Guide guide={guide} urgent={findings.length > 0} />}
        {canFault && (
          <label className="mt-3 grid grid-cols-[auto_1fr] items-center gap-2 text-[12px] text-muted">
            Simulate fault
            <select
              className={SELECT}
              value={fault ?? ''}
              onChange={(e) => ops.setFault(part.tag, (e.target.value || null) as FaultKind | null)}
            >
              <option value="">None</option>
              {(Object.keys(FAULTS) as FaultKind[]).map((k) => (
                <option key={k} value={k}>
                  {FAULTS[k].label}: {FAULTS[k].text}
                </option>
              ))}
            </select>
          </label>
        )}
      </section>
    </>
  );
}

/** The type's guide; diagnosis and immediate action open by themselves while something is wrong. */
function Guide({ guide, urgent }: { guide: TroubleshootingGuide; urgent: boolean }) {
  const parts: { title: string; items: string[] | string; ordered?: boolean; urgent?: boolean }[] = [
    { title: 'Symptoms', items: guide.symptoms },
    { title: 'Possible causes', items: guide.possibleCauses },
    { title: 'Diagnostic steps', items: guide.diagnosticSteps, ordered: true, urgent: true },
    { title: 'Immediate action', items: guide.immediateAction, urgent: true },
    { title: 'Operational impact', items: guide.operationalImpact },
    { title: 'Verification', items: guide.verificationSteps, ordered: true },
    { title: 'Prevention', items: guide.preventionMeasures },
  ];
  return (
    <div className="mt-2 text-[12px]">
      <p className="border-b border-panel-2 pb-1.5">
        <span className="text-muted">Failure condition: </span>
        {guide.failureCondition}
      </p>
      {parts.map(({ title, items, ordered, urgent: opens }) => (
        <details key={title} open={urgent && opens} className="border-b border-panel-2 py-1.5">
          <summary className="cursor-pointer font-[550]">{title}</summary>
          {typeof items === 'string' ? (
            <p className="mt-1">{items}</p>
          ) : ordered ? (
            <ol className="mt-1 list-decimal pl-5">
              {items.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          ) : (
            <ul className="mt-1 list-disc pl-5">
              {items.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          )}
        </details>
      ))}
    </div>
  );
}
