import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { ObjectSymbol2D } from "@shipdocs/viewer-core/objects";
import { indexSchematic, libraryBox, pipeRoute, pipeWeight } from "./geometry";
import { SchematicPanels } from "./panel";
import { useSchematicSelection } from "./selection";
import { selectionKey, type Crossing, type Equipment, type Point, type Schematic } from "./types";

/*
 * 2D (SVG) entry point of this ship's schematics. Never imports three.js: the viewer loads 2D views without it.
 */

const INK = "#0f172a";
const ACCENT = "var(--color-accent-600)";

// ---------------------------------------------------------------------------------------------------------------
// Pipes
// ---------------------------------------------------------------------------------------------------------------

const HOP = 6;

/** SVG path through `points`, with a hop (arc) or a break (gap) at each crossing that lies on a segment. */
export function pipePath(points: Point[], crossings: Crossing[] = []): string {
  if (points.length === 0) return "";
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 1; i < points.length; i += 1) {
    const [ax, ay] = points[i - 1];
    const [bx, by] = points[i];
    const length = Math.hypot(bx - ax, by - ay);
    if (length === 0) continue;
    const ux = (bx - ax) / length;
    const uy = (by - ay) / length;
    const onSegment = crossings
      .map((crossing) => ({ crossing, t: (crossing.at[0] - ax) * ux + (crossing.at[1] - ay) * uy }))
      .filter(({ crossing, t }) => {
        const off = Math.abs((crossing.at[0] - ax) * uy - (crossing.at[1] - ay) * ux);
        return off < 2 && t > HOP && t < length - HOP;
      })
      .sort((p, q) => p.t - q.t);
    for (const { crossing, t } of onSegment) {
      const before = [ax + ux * (t - HOP), ay + uy * (t - HOP)];
      const after = [ax + ux * (t + HOP), ay + uy * (t + HOP)];
      d += ` L${before[0]},${before[1]}`;
      d += crossing.style === "arc" ? ` A${HOP},${HOP} 0 0 1 ${after[0]},${after[1]}` : ` M${after[0]},${after[1]}`;
    }
    d += ` L${bx},${by}`;
  }
  return d;
}

export interface Pipe2DProps {
  points: Point[];
  crossings?: Crossing[];
  color: string;
  /** Stroke width in drawing pixels. */
  width?: number;
  highlighted?: boolean;
  dimmed?: boolean;
}

export function Pipe2D({ points, crossings, color, width = 2.4, highlighted = false, dimmed = false }: Pipe2DProps) {
  const d = pipePath(points, crossings);
  return (
    <g opacity={dimmed ? 0.35 : 1}>
      {highlighted && <path d={d} fill="none" stroke={ACCENT} strokeWidth={width + 4} strokeOpacity={0.35} strokeLinecap="round" strokeLinejoin="round" />}
      <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Equipment symbols, drawn horizontally around (0, 0); the item's group rotates them
// ---------------------------------------------------------------------------------------------------------------

function Bowtie({ h }: { h: number }) {
  const w = h * 0.6;
  return <path d={`M${-h},${-w} L${h},${w} L${h},${-w} L${-h},${w} Z`} fill="white" stroke={INK} strokeWidth={1.1} strokeLinejoin="round" />;
}

function Spring({ x, y, h }: { x: number; y: number; h: number }) {
  const s = h * 0.25;
  return (
    <polyline
      points={`${x},${y} ${x - s},${y - s} ${x + s},${y - 2 * s} ${x - s},${y - 3 * s} ${x + s},${y - 4 * s}`}
      fill="none"
      stroke={INK}
      strokeWidth={1}
    />
  );
}

/** A shared symbol for equipment without a Library object. */
export function EquipmentSymbol2D({ item, color }: { item: Equipment; color: string }) {
  const h = item.size / 2;
  switch (item.kind) {
    case "tank":
      return (
        <g>
          <rect x={-h} y={-h} width={item.size} height={item.size} fill={color} fillOpacity={0.28} stroke={color} strokeDasharray="3 2" />
          <circle r={h * 0.28} fill="none" stroke={INK} strokeWidth={0.9} />
        </g>
      );
    case "valve":
      return (
        <g>
          <Bowtie h={h} />
          {item.variant === "handwheel" && <path d={`M0,0 V${-h * 0.95} M${-h * 0.5},${-h * 0.95} H${h * 0.5}`} stroke={INK} strokeWidth={1.1} />}
          {item.variant === "globe" && <circle r={h * 0.24} fill={INK} />}
          {item.variant === "blind" && <rect x={h + 1} y={-h * 0.65} width={h * 0.35} height={h * 1.3} fill={INK} />}
        </g>
      );
    case "relief-valve":
      return (
        <g>
          <Bowtie h={h} />
          <Spring x={0} y={0} h={h * 1.6} />
        </g>
      );
    case "angle-valve": {
      const w = h * 0.6;
      return (
        <g>
          <path d={`M${-h},${-w} L${-h},${w} L0,0 Z M${-w},${-h} L${w},${-h} L0,0 Z`} fill="white" stroke={INK} strokeWidth={1.1} strokeLinejoin="round" />
          <path d={`M0,0 V${h * 0.35}`} stroke={INK} strokeWidth={1} />
          <polyline points={`0,${h * 0.35} ${h * 0.35},${h * 0.5} ${-h * 0.35},${h * 0.65} ${h * 0.35},${h * 0.8}`} fill="none" stroke={INK} strokeWidth={1} />
        </g>
      );
    }
    case "gauge":
      return (
        <g>
          <circle r={h} fill="white" stroke={INK} strokeWidth={1} />
          <text textAnchor="middle" dominantBaseline="central" fontSize={h * 0.95} fill={INK}>
            PI
          </text>
        </g>
      );
    case "spool":
      return (
        <path d={`M${-h},${-h * 0.6} V${h * 0.6} M${h},${-h * 0.6} V${h * 0.6} M${-h},${-h * 0.2} H${h} M${-h},${h * 0.2} H${h}`} stroke={INK} strokeWidth={1.2} />
      );
    case "end-flange":
      return (
        <g fill={INK}>
          <rect x={-h * 0.8} y={-item.size * 0.13} width={h * 1.6} height={item.size * 0.07} />
          <rect x={-h * 0.8} y={item.size * 0.06} width={h * 1.6} height={item.size * 0.07} />
        </g>
      );
    case "open-end":
      return item.variant === "circle" ? (
        <circle r={h} fill="white" stroke={INK} strokeWidth={1} />
      ) : (
        <path d={`M0,${h} V${-h} M0,${h * 0.2} L${-h * 0.75},${-h} M0,${h * 0.2} L${h * 0.75},${-h}`} stroke={INK} strokeWidth={0.9} />
      );
  }
}

/** Local (unrotated) bounds of an item's symbol, for its hit area and selection outline. */
function localBounds(item: Equipment): { x: number; y: number; width: number; height: number } {
  if (item.object) {
    const { clip } = libraryBox(item, item.object);
    return { x: clip.x - item.at[0], y: clip.y - item.at[1], width: clip.width, height: clip.height };
  }
  const h = item.size / 2;
  const extra = item.kind === "valve" && item.variant === "blind" ? h * 0.45 : 0;
  return { x: -h, y: -h, width: item.size + extra, height: item.size };
}

function defaultLabel(item: Equipment): { at: Point; rotate?: number } {
  const h = Math.max(item.size / 2, 8);
  return item.rotation === 90 || item.rotation === 270
    ? { at: [item.at[0] - h - 6, item.at[1]], rotate: -90 }
    : { at: [item.at[0], item.at[1] + h + 10] };
}

interface Item2DProps {
  item: Equipment;
  color: string;
  selected: boolean;
  connected: boolean;
  dimmed: boolean;
  onActivate: (key: string) => void;
}

/** One piece of equipment: its symbol (the Library's, or a shared one), tag and hit area, as a keyboard-usable button. */
export function Item2D({ item, color, selected, connected, dimmed, onActivate }: Item2DProps) {
  const key = selectionKey(item);
  const bounds = localBounds(item);
  const label = item.label ?? defaultLabel(item);
  const clipId = `clip-${item.id}`;
  const onKeyDown = (event: KeyboardEvent<SVGGElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onActivate(key);
    }
  };
  let symbol;
  if (item.object) {
    const { box, clip } = libraryBox(item, item.object);
    const local = (b: typeof box) => ({ x: b.x - item.at[0], y: b.y - item.at[1], width: b.width, height: b.height });
    const l = local(box);
    const c = local(clip);
    symbol = (
      <>
        <clipPath id={clipId}>
          <rect x={c.x} y={c.y} width={c.width} height={c.height} />
        </clipPath>
        <rect x={c.x} y={c.y} width={c.width} height={c.height} fill="white" />
        <g clipPath={`url(#${clipId})`}>
          <ObjectSymbol2D id={item.object} x={l.x} y={l.y} width={l.width} height={l.height} />
        </g>
      </>
    );
  } else {
    symbol = <EquipmentSymbol2D item={item} color={color} />;
  }
  const fontSize = item.size <= 16 ? 8.5 : 10.5;
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`${item.tag ? `${item.tag}, ` : ""}${item.name}`}
      aria-pressed={selected}
      onClick={(event) => {
        event.stopPropagation();
        onActivate(key);
      }}
      onKeyDown={onKeyDown}
      className="cursor-pointer outline-none [&:focus-visible>g>.focus-ring]:opacity-100"
      opacity={dimmed ? 0.4 : 1}
    >
      <title>{item.tag ? `${item.tag} · ${item.name}` : item.name}</title>
      <g transform={`translate(${item.at[0]} ${item.at[1]}) rotate(${item.rotation})`}>
        <rect x={bounds.x - 4} y={bounds.y - 4} width={bounds.width + 8} height={bounds.height + 8} fill="transparent" />
        {symbol}
        <rect
          className="focus-ring"
          x={bounds.x - 3}
          y={bounds.y - 3}
          width={bounds.width + 6}
          height={bounds.height + 6}
          rx={3}
          fill="none"
          stroke={ACCENT}
          strokeWidth={selected ? 2 : 1.2}
          strokeDasharray={selected ? undefined : "3 2"}
          opacity={selected || connected ? 1 : 0}
        />
      </g>
      {item.tag && (
        <text
          x={label.at[0]}
          y={label.at[1]}
          transform={label.rotate ? `rotate(${label.rotate} ${label.at[0]} ${label.at[1]})` : undefined}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={fontSize}
          fontWeight={selected ? 700 : 500}
          fill={selected ? ACCENT : INK}
        >
          {item.tag}
        </text>
      )}
    </g>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// The whole view
// ---------------------------------------------------------------------------------------------------------------

interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SchematicView2DProps {
  schematic: Schematic;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Whether the section has data.json records (shown in the overview). */
  hasData?: boolean;
}

/**
 * An interactive SVG schematic filling its parent: pan by dragging, zoom with the wheel or the buttons, select by
 * click or keyboard (Enter/Space), Escape or a background click to clear. The selected item, the pipes leading from
 * it and the equipment they reach are highlighted.
 */
export function SchematicView2D({ schematic, selectedId, onSelect, hasData = false }: SchematicView2DProps) {
  const index = useMemo(() => indexSchematic(schematic), [schematic]);
  const { selected, pipes: litPipes, items: litItems } = useSchematicSelection(index, selectedId);
  const routes = useMemo(() => new Map(schematic.pipes.map((pipe) => [pipe.id, pipeRoute(index, pipe)])), [index, schematic]);
  const home: ViewBox = useMemo(() => ({ x: 0, y: 100, w: schematic.width, h: schematic.height - 120 }), [schematic]);
  const [view, setView] = useState<ViewBox>(home);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; view: ViewBox; moved: boolean; pointer: number } | null>(null);
  const moved = useRef(false);

  const unitsPerPixel = () => {
    const rect = svgRef.current?.getBoundingClientRect();
    return rect && rect.width > 0 && rect.height > 0 ? Math.max(view.w / rect.width, view.h / rect.height) : 1;
  };

  const zoom = (factor: number, center?: { x: number; y: number }) =>
    setView((current) => {
      const w = Math.min(Math.max(current.w * factor, 80), schematic.width * 3);
      const f = w / current.w;
      const c = center ?? { x: current.x + current.w / 2, y: current.y + current.h / 2 };
      return { x: c.x - (c.x - current.x) * f, y: c.y - (c.y - current.y) * f, w, h: current.h * f };
    });

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const matrix = svg.getScreenCTM();
      const point = matrix ? new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()) : undefined;
      zoom(event.deltaY > 0 ? 1.15 : 1 / 1.15, point ? { x: point.x, y: point.y } : undefined);
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
    // zoom only uses setView's updater and the schematic's width.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schematic.width]);

  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    moved.current = false;
    drag.current = { x: event.clientX, y: event.clientY, view, moved: false, pointer: event.pointerId };
  };
  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const start = drag.current;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!start.moved && Math.hypot(dx, dy) < 4) return;
    if (!start.moved) {
      start.moved = true;
      moved.current = true;
      svgRef.current?.setPointerCapture(start.pointer);
    }
    const k = unitsPerPixel();
    setView({ ...start.view, x: start.view.x - dx * k, y: start.view.y - dy * k });
  };
  const onPointerUp = () => {
    if (drag.current?.moved) svgRef.current?.releasePointerCapture(drag.current.pointer);
    drag.current = null;
  };
  const activate = (key: string) => {
    if (!moved.current) onSelect(key);
  };

  const anySelected = selected !== null;

  return (
    <div className="relative h-full w-full overflow-hidden bg-white">
      <svg
        ref={svgRef}
        className="h-full w-full touch-none select-none"
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Bunker piping schematic"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={(event) => {
          if (event.key === "Escape") onSelect(null);
        }}
        onClick={() => {
          if (!moved.current) onSelect(null);
        }}
      >
        <g fontFamily="ui-sans-serif, system-ui, sans-serif">
          {schematic.labels.map((label, i) => (
            <text
              key={i}
              x={label.at[0]}
              y={label.at[1]}
              transform={label.rotate ? `rotate(${label.rotate} ${label.at[0]} ${label.at[1]})` : undefined}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={label.size ?? 8}
              fill="#334155"
              letterSpacing={label.size ? 1 : 0.5}
            >
              {label.text}
            </text>
          ))}
          {schematic.pipes.map((pipe) => (
            <Pipe2D
              key={pipe.id}
              points={routes.get(pipe.id) ?? []}
              crossings={pipe.crossings}
              color={schematic.fluids[pipe.fluid]?.color ?? INK}
              width={2.4 * pipeWeight(pipe.bore)}
              highlighted={litPipes.has(pipe.id)}
              dimmed={anySelected && !litPipes.has(pipe.id)}
            />
          ))}
          {schematic.junctions
            .filter((junction) => junction.dot)
            .map((junction) => (
              <circle key={junction.id} cx={junction.at[0]} cy={junction.at[1]} r={3} fill={INK} />
            ))}
          {schematic.equipment.map((item) => (
            <Item2D
              key={item.id}
              item={item}
              color={schematic.fluids[item.fluid]?.color ?? INK}
              selected={selected?.id === item.id}
              connected={litItems.has(item.id)}
              dimmed={anySelected && selected?.id !== item.id && !litItems.has(item.id)}
              onActivate={activate}
            />
          ))}
        </g>
      </svg>

      <div className="absolute right-2 bottom-2 z-10 flex gap-1">
        {[
          { label: "Zoom in", text: "+", run: () => zoom(1 / 1.3) },
          { label: "Zoom out", text: "−", run: () => zoom(1.3) },
          { label: "Reset view", text: "⟲", run: () => setView(home) },
        ].map((button) => (
          <button
            key={button.label}
            type="button"
            aria-label={button.label}
            title={button.label}
            onClick={button.run}
            className="size-8 rounded-md bg-white/90 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-accent-50 focus-visible:outline-2 focus-visible:outline-accent-600"
          >
            {button.text}
          </button>
        ))}
      </div>

      <SchematicPanels index={index} selected={selected} connected={litItems} onSelect={onSelect} hasData={hasData} />
    </div>
  );
}
