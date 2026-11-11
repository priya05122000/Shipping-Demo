import { useRef, useState, type MouseEvent } from 'react';
import type { Reading } from '../data/readings';
import type { SectionData } from '../data/sectionData';
import type { Crossing } from '../model/crossings';
import { partBox } from '../model/partSpecs';
import type { DiagramDef, PartDef } from '../model/types';
import type { FlowRun } from '../simulation/flow';
import { Callouts } from './Callouts';
import { FlowLines } from './FlowLines';
import { GlassPipes } from './GlassPipes';
import { Decorations, GroupBoxes, PartDefs, PartGlyph } from '../view/Parts';
import { UI } from '../view/theme';
import { Tooltip, type Hover } from '../view/Tooltip';
import { DiagramControls } from '../view/ui';
import { useLayoutMotion } from '../view/useLayoutMotion';
import { useZoomPan } from './useZoomPan';

/** Area names and captions; line numbers are drawn separately, with Tags. */
const TEXT_STYLE = {
  area: { fontSize: 22, fontWeight: 500, letterSpacing: 5 },
  note: { fontSize: 11, fontWeight: 600, letterSpacing: 0.4 },
};

interface Props {
  def: DiagramDef;
  crossings: Crossing[];
  data: SectionData;
  readings: Record<string, Reading>;
  /** Pipes with flow in them. */
  runs: FlowRun[];
  showValues: boolean;
  showTags: boolean;
  selected: string | null;
  onSelect: (tag: string | null) => void;
}

export function PipelineDiagram({ def, crossings, data, readings, runs, showValues, showTags, selected, onSelect }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zp = useZoomPan(svgRef, def.width, def.height);
  const [hover, setHover] = useState<Hover | null>(null);

  // While the sidebar or info panel slides, the drawing keeps its size and is scaled as a picture to what
  // the box would show, so the browser doesn't redraw the whole SVG every frame. It is redrawn once at the end.
  useLayoutMotion(() => {
    const svg = svgRef.current!;
    const box = wrapRef.current!;
    const fit = () => Math.min(box.clientWidth / def.width, box.clientHeight / def.height); // the scale 'meet' gives
    const start = fit();
    Object.assign(svg.style, {
      position: 'absolute',
      left: '50%',
      top: '50%',
      width: `${box.clientWidth}px`,
      height: `${box.clientHeight}px`,
    });
    const follow = () => {
      svg.style.transform = `translate(-50%, -50%) scale(${fit() / start})`;
    };
    follow();
    const watch = new ResizeObserver(follow);
    watch.observe(box);
    return () => {
      watch.disconnect();
      svg.removeAttribute('style');
    };
  });

  const track = (tag: string) => (e: MouseEvent) => {
    const r = wrapRef.current!.getBoundingClientRect();
    setHover({ tag, x: e.clientX - r.left, y: e.clientY - r.top });
  };

  const selectedPart = def.parts.find((p) => p.tag === selected);
  const hoverPart = hover ? def.parts.find((p) => p.tag === hover.tag) : undefined;

  return (
    <div className="relative min-h-0 min-w-0 overflow-hidden bg-page" ref={wrapRef}>
      {/* will-change gives the drawing its own layer, so it can be scaled as a picture while the layout slides (above). */}
      <svg
        ref={svgRef}
        className="block size-full cursor-grab touch-none select-none will-change-transform active:cursor-grabbing"
        viewBox={`${zp.vb.x} ${zp.vb.y} ${zp.vb.w} ${zp.vb.h}`}
        preserveAspectRatio="xMidYMid meet"
        {...zp.handlers}
        onClick={(e) => {
          if (!zp.panned.current && (e.target as Element).hasAttribute('data-bg')) onSelect(null);
        }}
        role="img"
        aria-label={def.title}
      >
        <PartDefs />
        <defs>
          <pattern id="grid" width={40} height={40} patternUnits="userSpaceOnUse">
            <path d="M40,0 L0,0 L0,40" fill="none" stroke={UI.grid} strokeWidth={0.6} />
          </pattern>
        </defs>
        <rect data-bg x={-def.width} y={-def.height} width={def.width * 3} height={def.height * 3} fill={UI.page} />
        <rect data-bg x={0} y={0} width={def.width} height={def.height} fill="url(#grid)" />

        <GroupBoxes items={def.decorations} />

        {def.labels.map(
          (l, i) =>
            l.kind !== 'line' && (
              <text
                key={i}
                x={l.at[0]}
                y={l.at[1]}
                transform={l.rot ? `rotate(${l.rot} ${l.at[0]} ${l.at[1]})` : undefined}
                textAnchor="middle"
                {...TEXT_STYLE[l.kind]}
                fill={UI.ink}
              >
                {l.text}
              </text>
            ),
        )}

        <GlassPipes def={def} crossings={crossings} />
        <FlowLines runs={runs} crossings={crossings} />
        <Decorations items={def.decorations} />

        {showTags &&
          def.labels
            .filter((l) => l.kind === 'line')
            .map((l, i) => (
              <text
                key={i}
                x={l.at[0]}
                y={l.at[1]}
                transform={l.rot ? `rotate(${l.rot} ${l.at[0]} ${l.at[1]})` : undefined}
                textAnchor="middle"
                className="font-mono"
                fontSize={9.5}
                letterSpacing={0.5}
                fill={UI.muted}
              >
                {l.text}
              </text>
            ))}

        {def.parts.map((p) => {
          const box = partBox(p);
          const hovered = hover?.tag === p.tag;
          return (
            <g
              key={p.tag}
              data-tag={p.tag}
              className={`cursor-pointer ${hovered ? '[&_.symbol]:brightness-112 [&_image]:brightness-112' : ''}`}
              onMouseEnter={track(p.tag)}
              onMouseMove={track(p.tag)}
              onMouseLeave={() => setHover(null)}
              onClick={() => {
                if (!zp.panned.current) onSelect(p.tag === selected ? null : p.tag);
              }}
            >
              <PartGlyph part={p} reading={readings[p.tag]} connected={data.hoses[p.tag]?.connected} gaugeMax={data.gauges[p.tag]?.maxBar} />
              <rect
                className={`transition-[fill,stroke] duration-120 ${hovered ? 'fill-highlight/6 stroke-highlight/70' : 'fill-transparent stroke-transparent'}`}
                strokeWidth={1.2}
                x={box.x0 - 3}
                y={box.y0 - 3}
                width={box.x1 - box.x0 + 6}
                height={box.y1 - box.y0 + 6}
                rx={4}
              />
            </g>
          );
        })}

        <Callouts parts={def.parts} readings={readings} showValues={showValues} showTags={showTags} />

        {selectedPart && <SelectionRing part={selectedPart} />}
      </svg>

      <DiagramControls zoomIn={zp.zoomIn} zoomOut={zp.zoomOut} fit={zp.fit} />

      {hover && hoverPart && (
        <Tooltip part={hoverPart} hover={hover} wrapWidth={wrapRef.current?.clientWidth ?? 0} reading={readings[hoverPart.tag]} />
      )}
    </div>
  );
}

function SelectionRing({ part }: { part: PartDef }) {
  const b = partBox(part);
  const pad = 6;
  return (
    <rect
      className="animate-sel-dash motion-reduce:animate-none"
      fill="none"
      stroke={UI.highlight}
      strokeWidth={1.8}
      strokeDasharray="6 4"
      x={b.x0 - pad}
      y={b.y0 - pad}
      width={b.x1 - b.x0 + pad * 2}
      height={b.y1 - b.y0 + pad * 2}
      rx={6}
      pointerEvents="none"
    />
  );
}
