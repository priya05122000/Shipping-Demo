import type { Reading } from '../data/readings';
import { kindLabel, refNumber } from '../model/partSpecs';
import type { PartDef } from '../model/types';
import { STATUS_COLOR } from './theme';
import { Chip } from './ui';

/** The part under the pointer, and the pointer's position in the diagram box. */
export interface Hover {
  tag: string;
  x: number;
  y: number;
}

export function Tooltip({ part, hover, wrapWidth, reading }: { part: PartDef; hover: Hover; wrapWidth: number; reading?: Reading }) {
  const flipX = hover.x > wrapWidth - 280;
  return (
    <div
      className="pointer-events-none absolute z-5 max-w-67.5 min-w-50 rounded-[10px] border border-line bg-panel/96 px-3 py-2.5 text-[12px] shadow-[0_12px_30px_color-mix(in_srgb,var(--ink)_20%,transparent)]"
      style={{
        left: flipX ? undefined : hover.x + 16,
        right: flipX ? wrapWidth - hover.x + 16 : undefined,
        top: hover.y + 14,
      }}
    >
      <div className="text-[13px] font-[650]">{part.name}</div>
      <div className="mt-1 flex items-center gap-2 text-[11px] text-muted">
        <Chip>{part.tag}</Chip>
        <span>#{refNumber(part)} · {kindLabel(part)}</span>
      </div>
      {reading && (
        <>
          <div className="mt-2 font-mono text-[15px] font-bold" style={{ color: STATUS_COLOR[reading.status] }}>{reading.value}</div>
          <dl className="mt-1.5">
            {reading.rows.slice(0, 3).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 py-0.75">
                <dt className="text-muted">{k}</dt>
                <dd className="text-right tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </div>
  );
}
