import { memo, type ComponentType } from 'react';
import { ObjectSymbol2D } from '../../objects/ObjectSymbol2D';
import type { Reading } from '../data/readings';
import { BOX_TANK_2D, GAUGE_RADIUS, TANK_INTERIOR, VALVE_KINDS, isBoxTank, partBox, placementOf } from '../model/partSpecs';
import { FLUIDS, type Decoration, type PartDef, type PartKind } from '../model/types';
import { FLUID_STYLE, GAUGE, MATERIAL, PAINT, SHADE, STATUS_COLOR, STEEL, UI } from './theme';

/** Shared gradients for parts. */
export function PartDefs() {
  return (
    <defs>
      <linearGradient id="metal" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={STEEL.light} />
        <stop offset="0.45" stopColor={STEEL.mid} />
        <stop offset="1" stopColor={STEEL.dark} />
      </linearGradient>
      <linearGradient id="metal-v" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor={STEEL.light} />
        <stop offset="0.45" stopColor={STEEL.mid} />
        <stop offset="1" stopColor={STEEL.dark} />
      </linearGradient>
      <radialGradient id="bezel" cx="0.35" cy="0.3" r="0.8">
        <stop offset="0" stopColor={GAUGE.bezel[0]} />
        <stop offset="0.55" stopColor={GAUGE.bezel[1]} />
        <stop offset="1" stopColor={GAUGE.bezel[2]} />
      </radialGradient>
      {FLUIDS.map((f) => (
        <linearGradient key={f} id={`liq-${f}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={FLUID_STYLE[f].dark} />
          <stop offset="0.38" stopColor={FLUID_STYLE[f].liquid} />
          <stop offset="0.62" stopColor={FLUID_STYLE[f].liquid} />
          <stop offset="1" stopColor={FLUID_STYLE[f].dark} />
        </linearGradient>
      ))}
      {/* Paint for the SVG symbols: lit from above, and from the left on upright bodies. */}
      {(['red', 'blue'] as const).map((c) => (
        <linearGradient key={c} id={`paint-${c}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={PAINT[c][0]} />
          <stop offset="0.5" stopColor={PAINT[c][1]} />
          <stop offset="1" stopColor={PAINT[c][2]} />
        </linearGradient>
      ))}
      <linearGradient id="paint-red-v" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor={PAINT.red[0]} />
        <stop offset="0.4" stopColor={PAINT.red[1]} />
        <stop offset="1" stopColor={PAINT.red[2]} />
      </linearGradient>
      <radialGradient id="paint-red-r" cx="0.38" cy="0.32" r="0.75">
        <stop offset="0" stopColor={PAINT.red[0]} />
        <stop offset="0.55" stopColor={PAINT.red[1]} />
        <stop offset="1" stopColor={PAINT.red[2]} />
      </radialGradient>
      {/* Chequer-plate tread on the box tank's front, and slanted to lie on its top and side. */}
      {[
        ['tread', undefined],
        ['tread-top', 'matrix(1 0 0.7 -0.5 0 0)'],
        ['tread-side', 'matrix(0.7 -0.5 0 1 0 0)'],
      ].map(([id, transform]) => (
        <pattern key={id} id={id} width={6} height={6} patternUnits="userSpaceOnUse" patternTransform={transform}>
          {[
            [1.5, 1.5, 45],
            [4.5, 4.5, 45],
            [4.5, 1.5, -45],
            [1.5, 4.5, -45],
          ].map(([x, y, a]) => (
            <ellipse key={`${x},${y}`} cx={x} cy={y} rx={1} ry={0.28} transform={`rotate(${a} ${x} ${y})`} fill={MATERIAL.boxTank.tread} opacity={0.75} />
          ))}
        </pattern>
      ))}
    </defs>
  );
}

interface GlyphProps {
  part: PartDef;
  reading?: Reading;
  connected?: boolean;
  /** Gauges: top of the dial (bar). */
  gaugeMax?: number;
}

/** Parts drawn in SVG, in their own frame: the pipe runs left to right through (0, 0). */
const SYMBOLS: Partial<Record<PartKind, ComponentType>> = { NRV: CheckValveSymbol, PU: PumpSymbol, FL: FilterSymbol };

export const PartGlyph = memo(function PartGlyph({ part, reading, connected, gaugeMax }: GlyphProps) {
  if (isBoxTank(part)) return <BoxTankGlyph part={part} level={reading?.num ?? 0} />;
  if (part.kind === 'TK') return <TankGlyph part={part} level={reading?.num ?? 0} />;
  if (part.kind === 'PI') return <Gauge part={part} bar={reading?.num ?? 0} max={gaugeMax ?? 16} />;

  const [x, y] = part.at;
  const box = partBox(part);
  const Symbol = SYMBOLS[part.kind];
  const place = placementOf(part);
  return (
    <g>
      <g transform={`translate(${x} ${y}) rotate(${part.rot ?? 0}) scale(${part.flip ? -1 : 1} 1)`}>
        {part.kind === 'MC' ? (
          <ManifoldConnection dir={part.hoseDir ?? -1} connected={!!connected} />
        ) : Symbol ? (
          <g className="symbol">
            <Symbol />
          </g>
        ) : (
          // Its Library object's 2D picture, or a dashed placeholder while it has none.
          place && <ObjectSymbol2D id={part.object ?? ''} x={-place.ax * place.w} y={-place.ay * place.h} width={place.w} height={place.h} />
        )}
      </g>
      {(VALVE_KINDS.has(part.kind) || part.kind === 'PU') && reading && (
        <circle
          cx={box.x1 - 1}
          cy={box.y0 + 1}
          r={3.4}
          fill={STATUS_COLOR[reading.status]}
          stroke={UI.page}
          strokeWidth={1.2}
          className={reading.status === 'open' ? 'drop-shadow-[0_0_2px_color-mix(in_srgb,var(--open)_90%,transparent)]' : undefined}
        />
      )}
    </g>
  );
});

function TankGlyph({ part, level }: { part: PartDef; level: number }) {
  const spec = placementOf(part)!;
  const style = FLUID_STYLE[part.fluid];
  const [cx, cy] = part.at;
  const x0 = cx - spec.w / 2;
  const y0 = cy - spec.h / 2;
  const ix0 = x0 + spec.w * TANK_INTERIOR.x0;
  const ix1 = x0 + spec.w * TANK_INTERIOR.x1;
  const top = y0 + spec.h * TANK_INTERIOR.top;
  const bottom = y0 + spec.h * TANK_INTERIOR.bottom;
  const surface = bottom - (bottom - top) * Math.min(1, Math.max(0, level / 100));
  const rx = (ix1 - ix0) / 2;
  const ry = rx * 0.22;
  const mid = (ix0 + ix1) / 2;

  return (
    <g>
      <ellipse cx={cx} cy={y0 + spec.h - 3} rx={spec.w * 0.42} ry={4} fill={SHADE.shadow} opacity={0.45} />
      {/* Its Library object's 2D picture (a glass cylinder), with the liquid drawn over it to its level. */}
      <ObjectSymbol2D id={part.object ?? ''} x={x0} y={y0} width={spec.w} height={spec.h} />
      <path
        d={`M${ix0},${surface} L${ix0},${bottom} A${rx},${ry} 0 0 0 ${ix1},${bottom} L${ix1},${surface} A${rx},${ry} 0 0 1 ${ix0},${surface} Z`}
        fill={`url(#liq-${part.fluid})`}
        opacity={0.8}
      />
      <ellipse cx={mid} cy={surface} rx={rx} ry={ry} fill={style.liquidHi} opacity={0.85} />
      <rect x={ix0 + rx * 0.28} y={surface + ry} width={2.2} height={Math.max(0, bottom - surface - ry)} fill={SHADE.shine} opacity={0.28} />
      {/* Level marks every 25 %. */}
      {[25, 50, 75].map((m) => {
        const yy = bottom - ((bottom - top) * m) / 100;
        return <line key={m} x1={ix1 - 5} x2={ix1 - 1} y1={yy} y2={yy} stroke={SHADE.shine} strokeWidth={0.8} opacity={0.55} />;
      })}
    </g>
  );
}

/**
 * The see-through chequer-plate box tank, drawn at a slant: front, top and right side, with the far edges
 * and the liquid showing through. Lifting lugs at the top corners and three nozzles on top, as in 3D.
 */
function BoxTankGlyph({ part, level }: { part: PartDef; level: number }) {
  const { x0, x1, top, bottom, back } = BOX_TANK_2D;
  const [bx, by] = back;
  const [cx, cy] = part.at;
  const style = FLUID_STYLE[part.fluid];
  const pts = (...p: [number, number][]) => p.map(([x, y]) => `${x},${y}`).join(' ');
  // The box from height y0 up to y1 (front-face heights): front, top and side faces.
  const faces = (y0: number, y1: number) => ({
    front: pts([x0, y1], [x1, y1], [x1, y0], [x0, y0]),
    top: pts([x0, y1], [x1, y1], [x1 + bx, y1 + by], [x0 + bx, y1 + by]),
    side: pts([x1, y1], [x1 + bx, y1 + by], [x1 + bx, y0 + by], [x1, y0]),
  });
  const shell = faces(bottom, top);
  const surface = bottom - (bottom - top - 1.5) * Math.min(1, Math.max(0, level / 100));
  const liquid = faces(bottom - 0.6, surface);
  /** A point on the top plate: u across it, v back from the front edge. */
  const onTop = (u: number, v: number): [number, number] => [x0 + (x1 - x0) * u + bx * v, top + by * v];
  const edge = { fill: 'none', stroke: STEEL.dim, strokeWidth: 1.1, strokeLinejoin: 'round' } as const;

  return (
    <g transform={`translate(${cx} ${cy})`}>
      <polygon points={pts([x0, bottom], [x1, bottom], [x1 + bx, bottom + by], [x0 + bx, bottom + by])} fill={SHADE.shadow} opacity={0.18} transform="translate(2 3)" />
      {/* The far edges, seen through the plates. */}
      <polyline points={pts([x0, bottom], [x0 + bx, bottom + by], [x1 + bx, bottom + by])} {...edge} strokeWidth={0.8} opacity={0.4} />
      <line x1={x0 + bx} y1={bottom + by} x2={x0 + bx} y2={top + by} {...edge} strokeWidth={0.8} opacity={0.4} />
      {level > 0 && (
        <g>
          <polygon points={liquid.side} fill={style.dark} opacity={0.45} />
          <polygon points={liquid.front} fill={`url(#liq-${part.fluid})`} opacity={0.6} />
          <polygon points={liquid.top} fill={style.liquidHi} opacity={0.75} />
        </g>
      )}
      {(['front', 'top', 'side'] as const).map((f) => (
        <g key={f}>
          <polygon points={shell[f]} fill={MATERIAL.boxTank.glass} opacity={f === 'front' ? 0.2 : 0.35} />
          <polygon points={shell[f]} fill={`url(#${f === 'front' ? 'tread' : `tread-${f}`})`} />
          <polygon points={shell[f]} {...edge} />
        </g>
      ))}
      {[onTop(0, 0), onTop(1, 0), onTop(1, 1), onTop(0, 1)].map(([x, y]) => (
        <g key={`${x},${y}`}>
          <circle cx={x} cy={y - 2.6} r={2.3} fill={MATERIAL.boxTank.paint} stroke={STEEL.dim} strokeWidth={0.6} />
          <circle cx={x} cy={y - 2.6} r={0.9} fill={UI.page} />
        </g>
      ))}
      {[
        { at: onTop(0.25, 0.45), w: 4.4, capped: false },
        { at: onTop(0.5, 0.8), w: 3.8, capped: true },
        { at: onTop(0.75, 0.5), w: 3.8, capped: true },
      ].map(({ at: [x, y], w, capped }) => (
        <g key={`${x},${y}`} stroke={STEEL.outline} strokeWidth={0.4}>
          <rect x={x - w / 2} y={y - 5} width={w} height={5} fill="url(#metal-v)" />
          {capped ? (
            <rect x={x - w / 2 - 0.6} y={y - 6.8} width={w + 1.2} height={2.2} rx={0.6} fill="url(#metal-v)" />
          ) : (
            <ellipse cx={x} cy={y - 5} rx={w / 2} ry={0.9} fill={STEEL.darker} />
          )}
        </g>
      ))}
      {/* Level marks every 25 %. */}
      {[25, 50, 75].map((m) => {
        const yy = bottom - ((bottom - top) * m) / 100;
        return <line key={m} x1={x1 - 6} x2={x1 - 1.5} y1={yy} y2={yy} stroke={STEEL.dim} strokeWidth={0.8} opacity={0.6} />;
      })}
    </g>
  );
}

function Gauge({ part, bar, max }: { part: PartDef; bar: number; max: number }) {
  const [x, y] = part.at;
  const r = GAUGE_RADIUS;
  const angle = -135 + (Math.min(max, Math.max(0, bar)) / max) * 270;
  const tick = (i: number) => {
    const a = ((-135 + (i * 270) / 8 - 90) * Math.PI) / 180;
    const r1 = i % 2 ? 9.4 : 8.4;
    return <line key={i} x1={Math.cos(a) * r1} y1={Math.sin(a) * r1} x2={Math.cos(a) * 10.6} y2={Math.sin(a) * 10.6} stroke={GAUGE.ink} strokeWidth={i % 2 ? 0.5 : 0.9} />;
  };
  const arc = (from: number, to: number, rad: number) => {
    const p = (deg: number) => {
      const a = ((deg - 90) * Math.PI) / 180;
      return `${Math.cos(a) * rad},${Math.sin(a) * rad}`;
    };
    return `M${p(from)} A${rad},${rad} 0 ${to - from > 180 ? 1 : 0} 1 ${p(to)}`;
  };
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={r + 1} fill={SHADE.shadow} opacity={0.35} transform="translate(1 2)" />
      <circle r={r} fill="url(#bezel)" stroke={GAUGE.hub} strokeWidth={0.6} />
      <circle r={r - 2.6} fill={GAUGE.face} />
      <path d={arc(-135, 67, 10.2)} stroke={GAUGE.normal} strokeWidth={1.1} fill="none" opacity={0.6} />
      <path d={arc(67, 135, 10.2)} stroke={GAUGE.high} strokeWidth={1.4} fill="none" />
      {Array.from({ length: 9 }, (_, i) => tick(i))}
      <text y={6.2} textAnchor="middle" fontSize={3.4} fill={GAUGE.unit} className="font-mono">bar</text>
      <text y={-3.6} textAnchor="middle" fontSize={3.6} fill={GAUGE.ink} fontWeight={700}>PI</text>
      {/* Turns about the dial's centre (its box's, thanks to the circle) and swings to a new reading. */}
      <g
        className="origin-center transition-transform duration-900 ease-[cubic-bezier(0.3,0.7,0.4,1)] transform-fill"
        style={{ transform: `rotate(${angle}deg)` }}
      >
        <circle r={9.6} fill="none" />
        <path d="M-0.95,1.6 L0,-9.4 L0.95,1.6 Z" fill={GAUGE.needle} />
      </g>
      <circle r={1.7} fill={GAUGE.hub} />
      <ellipse cx={-3.5} cy={-5} rx={5} ry={2.6} fill={SHADE.shine} opacity={0.45} transform="rotate(-30 -3.5 -5)" />
    </g>
  );
}

/** Manifold flange, in its own frame (PartGlyph turns it with rot): the hose leaves upwards (dir -1) or downwards. */
function ManifoldConnection({ dir: d, connected }: { dir: -1 | 1; connected: boolean }) {
  const bar = (yy: number, h: number, dark = false) => (
    <g>
      <rect x={-13} y={yy - h / 2} width={26} height={h} rx={1} fill={dark ? STEEL.darker : 'url(#metal)'} stroke={STEEL.outline} strokeWidth={0.5} />
      {[-9, 9].map((bx) => (
        <circle key={bx} cx={bx} cy={yy} r={1.1} fill={STEEL.bolt} stroke={STEEL.darker} strokeWidth={0.3} />
      ))}
    </g>
  );
  // The hose path runs from the supplier towards the flange.
  const hose = `M-24,${75 * d} C-24,${40 * d} 0,${32 * d} 0,${9 * d}`;
  return (
    <g>
      {connected && (
        <g fill="none" strokeLinecap="round">
          <path d={hose} stroke={SHADE.shadow} strokeWidth={14} opacity={0.35} transform="translate(2 2)" />
          <path d={hose} stroke={STEEL.outline} strokeWidth={12} />
          <path d={hose} stroke={STEEL.dark} strokeWidth={2.4} transform="translate(-3 0)" opacity={0.8} />
          <rect x={-8} y={d < 0 ? -13 : 6} width={16} height={7} rx={1.5} fill="url(#metal-v)" stroke={STEEL.outline} strokeWidth={0.5} />
        </g>
      )}
      {bar(0, 3.6)}
      {bar(5 * d, connected ? 3.6 : 4.4, !connected)}
    </g>
  );
}

/** A flange across the pipe at x, in the symbols' blue paint. */
function PaintedFlange({ x, h }: { x: number; h: number }) {
  return <rect x={x - 2} y={-h / 2} width={4} height={h} rx={0.8} fill="url(#paint-blue)" stroke={PAINT.blue[2]} strokeWidth={0.5} />;
}

/** Bolt heads in a row at height y. */
function Bolts({ xs, y }: { xs: number[]; y: number }) {
  return (
    <>
      {xs.map((x) => (
        <circle key={x} cx={x} cy={y} r={0.9} fill={STEEL.bolt} stroke={STEEL.darker} strokeWidth={0.3} />
      ))}
    </>
  );
}

/** Non-return (swing check) valve: flanged body, bolted cover over the disc, and an arrow the way it lets flow through. */
function CheckValveSymbol() {
  return (
    <g>
      <ellipse cx={1} cy={10} rx={15} ry={2} fill={SHADE.shadow} opacity={0.25} />
      <PaintedFlange x={-15} h={19} />
      <PaintedFlange x={15} h={19} />
      <path
        d="M-13,-5 C-9,-6 -9,-9 0,-9 C9,-9 9,-6 13,-5 L13,5 C9,6 9,8.5 0,8.5 C-9,8.5 -9,6 -13,5 Z"
        fill="url(#paint-red)"
        stroke={PAINT.red[2]}
        strokeWidth={0.5}
      />
      <rect x={-8} y={-14} width={16} height={5} rx={1} fill="url(#paint-blue)" stroke={PAINT.blue[2]} strokeWidth={0.5} />
      <Bolts xs={[-5, 0, 5]} y={-11.5} />
      <path d="M-7,-1 L1,-1 L1,-3.6 L6.5,0 L1,3.6 L1,1 L-7,1 Z" fill={STEEL.light} opacity={0.9} />
    </g>
  );
}

/** Centrifugal pump, after the drawing's symbol: casing on a pedestal and baseplate, flanged nozzles either side. */
function PumpSymbol() {
  return (
    <g>
      <ellipse cx={0} cy={25} rx={27} ry={2.6} fill={SHADE.shadow} opacity={0.3} />
      <rect x={-24} y={19} width={48} height={5} rx={1} fill="url(#metal)" stroke={STEEL.outline} strokeWidth={0.5} />
      <path d="M-11,9 L-17,19.5 L17,19.5 L11,9 Z" fill="url(#paint-red)" stroke={PAINT.red[2]} strokeWidth={0.5} />
      <rect x={-25} y={-5} width={12} height={10} fill="url(#paint-red)" />
      <rect x={13} y={-5} width={12} height={10} fill="url(#paint-red)" />
      <PaintedFlange x={-27} h={19} />
      <PaintedFlange x={27} h={19} />
      <circle r={16} fill="url(#paint-red-r)" stroke={PAINT.red[2]} strokeWidth={0.7} />
      <circle r={12.6} fill="none" stroke={PAINT.red[0]} strokeWidth={0.6} opacity={0.6} />
      {Array.from({ length: 8 }, (_, i) => {
        const a = ((i + 0.5) / 8) * Math.PI * 2;
        return <circle key={i} cx={Math.cos(a) * 14.3} cy={Math.sin(a) * 14.3} r={0.8} fill={STEEL.bolt} stroke={STEEL.darker} strokeWidth={0.3} />;
      })}
      <path d="M8,-8.5 L-10,0 L8,8.5" fill="none" stroke={STEEL.light} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
      <circle r={3.2} fill="url(#metal)" stroke={STEEL.outline} strokeWidth={0.4} />
    </g>
  );
}

/** One side of a duplex filter: a canister below the line with its nozzles on it, a bolted domed cover and a vent. */
function FilterSymbol() {
  const R = 15;
  return (
    <g>
      <ellipse cx={0} cy={54} rx={17} ry={2.6} fill={SHADE.shadow} opacity={0.3} />
      <rect x={-R - 7} y={-4.5} width={8} height={9} fill="url(#paint-red)" />
      <rect x={R - 1} y={-4.5} width={8} height={9} fill="url(#paint-red)" />
      <PaintedFlange x={-R - 9} h={17} />
      <PaintedFlange x={R + 9} h={17} />
      <path d={`M${-R},-20 L${-R},44 Q${-R},52 0,52 Q${R},52 ${R},44 L${R},-20 Z`} fill="url(#paint-red-v)" stroke={PAINT.red[2]} strokeWidth={0.6} />
      <rect x={-R + 3} y={-17} width={2.2} height={58} rx={1} fill={SHADE.shine} opacity={0.3} />
      <rect x={-2} y={51} width={4} height={4} rx={0.6} fill="url(#metal-v)" stroke={STEEL.outline} strokeWidth={0.4} />
      <path d={`M${-R},-25 Q${-R},-37 0,-38 Q${R},-37 ${R},-25 Z`} fill="url(#paint-blue)" stroke={PAINT.blue[2]} strokeWidth={0.5} />
      <rect x={-R - 3} y={-25} width={(R + 3) * 2} height={5} rx={1} fill="url(#paint-blue)" stroke={PAINT.blue[2]} strokeWidth={0.5} />
      <Bolts xs={[-15, -9, -3, 3, 9, 15]} y={-22.5} />
      <rect x={-2} y={-43} width={4} height={5.5} rx={0.6} fill="url(#metal-v)" stroke={STEEL.outline} strokeWidth={0.4} />
    </g>
  );
}

/** Dashed boxes round groups of parts. Drawn under the pipes. */
export function GroupBoxes({ items }: { items: Decoration[] }) {
  return (
    <g className="groups" fill="none" stroke={UI.muted} strokeOpacity={0.6} strokeWidth={1.2} strokeDasharray="8 6">
      {items.map((d, i) => d.type === 'group' && <rect key={i} x={d.at[0]} y={d.at[1]} width={d.size[0]} height={d.size[1]} rx={4} />)}
    </g>
  );
}

export function Decorations({ items }: { items: Decoration[] }) {
  return (
    <g className="decorations">
      {items.map((d, i) => {
        const [x, y] = d.at;
        switch (d.type) {
          case 'drip':
            return (
              <g key={i} stroke={STEEL.mid} strokeWidth={1.3} strokeLinecap="round">
                <line x1={x} y1={y + 3 * d.dir} x2={x} y2={y + 13 * d.dir} />
                <line x1={x - 2} y1={y + 3 * d.dir} x2={x - 7} y2={y + 11 * d.dir} />
                <line x1={x + 2} y1={y + 3 * d.dir} x2={x + 7} y2={y + 11 * d.dir} />
              </g>
            );
          case 'cap':
            return d.orient === 'v' ? (
              <rect key={i} x={x - 3} y={y - 10} width={5} height={20} rx={1} fill="url(#metal-v)" stroke={STEEL.outline} strokeWidth={0.5} />
            ) : (
              <rect key={i} x={x - 10} y={y - 3} width={20} height={5} rx={1} fill="url(#metal)" stroke={STEEL.outline} strokeWidth={0.5} />
            );
          case 'ring':
            return (
              <g key={i}>
                <circle cx={x} cy={y} r={7} fill={UI.page} stroke="url(#metal)" strokeWidth={3} />
                <circle cx={x} cy={y} r={8.6} fill="none" stroke={STEEL.outline} strokeWidth={0.5} />
              </g>
            );
          case 'nub':
            return <rect key={i} x={x + 7} y={y - 3.5} width={6} height={7} rx={1} fill="url(#metal-v)" stroke={STEEL.outline} strokeWidth={0.5} />;
          case 'fluidLabel':
            return (
              <text key={i} x={x} y={y} fontSize={13} fontWeight={700} fill={UI.ink} letterSpacing={0.5}>
                {d.text}
              </text>
            );
          case 'group':
            return null; // GroupBoxes draws these, under the pipes
        }
      })}
    </g>
  );
}
