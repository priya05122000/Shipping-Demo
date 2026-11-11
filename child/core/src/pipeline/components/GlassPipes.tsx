import { memo } from 'react';
import type { Crossing } from '../diagram/crossings';
import type { DiagramDef, PipeDef, Pt } from '../diagram/types';
import { FLUID_STYLE, SHADE, pipeWidth } from './theme';

interface Props {
  def: DiagramDef;
  crossings: Crossing[];
}

const pathD = (pts: Pt[]) => `M${pts.map((p) => p.join(',')).join('L')}`;
const maskId = (pipeId: string) => `cut-${pipeId}`;

/** Pull both ends in by d, so a layer drawn offset by d stays inside the pipe ends. */
function trimEnds(pts: Pt[], d: number): Pt[] {
  const out = [...pts];
  const pull = (i: number, toward: number) => {
    const [x, y] = pts[i];
    const [tx, ty] = pts[toward];
    const len = Math.hypot(tx - x, ty - y);
    if (len === 0) return;
    const k = Math.min(d, len / 2) / len;
    out[i] = [x + (tx - x) * k, y + (ty - y) * k];
  };
  pull(0, 1);
  pull(pts.length - 1, pts.length - 2);
  return out;
}

/**
 * Glass pipes, drawn layer by layer across all pipes so T-junctions merge
 * cleanly. Where pipes cross, the lower one is cut away around the upper one.
 */
export const GlassPipes = memo(function GlassPipes({ def, crossings }: Props) {
  const underIds = new Set(crossings.map((c) => c.under.id));
  const mask = (p: PipeDef) => (underIds.has(p.id) ? `url(#${maskId(p.id)})` : undefined);
  const dash = (p: PipeDef) => (p.dashed ? '10 7' : undefined);

  const layer = (
    key: string,
    stroke: (p: PipeDef) => string,
    width: (p: PipeDef) => number,
    opacity: number,
    opts: { shift?: (p: PipeDef) => number; skipDashed?: boolean; cap?: 'butt' | 'round' } = {},
  ) => (
    <g key={key} opacity={opacity} fill="none" strokeLinejoin="round" strokeLinecap={opts.cap ?? 'butt'}>
      {def.pipes
        .filter((p) => !(opts.skipDashed && p.dashed))
        .map((p) => {
          const s = opts.shift?.(p) ?? 0;
          const path = (
            <path
              key={p.id}
              d={pathD(s ? trimEnds(p.pts, Math.abs(s)) : p.pts)}
              stroke={stroke(p)}
              strokeWidth={width(p)}
              strokeDasharray={dash(p)}
              transform={s ? `translate(${s} ${s})` : undefined}
            />
          );
          // The mask sits on a wrapper so the offset doesn't move the cut-out.
          const m = mask(p);
          return m ? (
            <g key={p.id} mask={m}>
              {path}
            </g>
          ) : (
            path
          );
        })}
    </g>
  );

  return (
    <g className="pipes">
      <defs>
        {[...underIds].map((id) => (
          <mask key={id} id={maskId(id)} maskUnits="userSpaceOnUse" x={0} y={0} width={def.width} height={def.height}>
            <rect x={0} y={0} width={def.width} height={def.height} fill="#fff" />
            {crossings
              .filter((c) => c.under.id === id)
              .map((c, i) => {
                // Turned to the upper pipe: across it, its width and a margin; along it, enough to take out the lower pipe.
                const across = pipeWidth(c.over) / 2 + 4;
                const along = (pipeWidth(c.under) / 2 + 6) / c.sin;
                return (
                  <rect
                    key={i}
                    x={c.x - along}
                    y={c.y - across}
                    width={along * 2}
                    height={across * 2}
                    transform={`rotate(${c.overAngle} ${c.x} ${c.y})`}
                    fill="#000"
                  />
                );
              })}
          </mask>
        ))}
      </defs>

      {layer('shadow', () => SHADE.shadow, (p) => pipeWidth(p) + 3, 0.4, { shift: () => 2 })}
      {layer('rim', (p) => FLUID_STYLE[p.fluid].rim, pipeWidth, 0.6)}
      {layer('glass', (p) => FLUID_STYLE[p.fluid].glass, (p) => pipeWidth(p) - 2.6, 0.2)}
      {layer('liquid', (p) => FLUID_STYLE[p.fluid].liquid, (p) => pipeWidth(p) * 0.52, 0.95, { skipDashed: true })}
      {layer('liquid-hi', (p) => FLUID_STYLE[p.fluid].liquidHi, (p) => pipeWidth(p) * 0.15, 0.55, {
        skipDashed: true,
        shift: (p) => -pipeWidth(p) * 0.1,
      })}
      {layer('highlight', () => SHADE.shine, () => 1.3, 0.7, { shift: (p) => -pipeWidth(p) * 0.3 })}

      {def.pipes
        .filter((p) => p.arrowEnd)
        .map((p) => {
          const [a, b] = p.pts.slice(-2);
          const ang = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
          return (
            <path
              key={`arrow-${p.id}`}
              d="M0,-5 L9,0 L0,5 Z"
              fill={FLUID_STYLE[p.fluid].rim}
              opacity={0.8}
              transform={`translate(${b[0]} ${b[1]}) rotate(${ang})`}
            />
          );
        })}
    </g>
  );
});
