import { Canvas } from '@react-three/fiber';
import { Component, useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { Reading } from '../data/readings';
import type { SectionData } from '../data/sectionData';
import type { Crossing } from '../diagram/crossings';
import type { DiagramDef } from '../diagram/types';
import type { FlowRun } from '../operations/flow';
import { LABEL_LAYER } from '../scene3d/labels';
import { PipelineScene, type CalloutRegistry, type ViewApi } from '../scene3d/Scene';
import { STATUS_COLOR } from './theme';
import { Tooltip, type Hover } from './Tooltip';
import { DiagramControls } from './ui';
import { useLayoutMotion } from './useLayoutMotion';

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

/** Shows a message instead of the canvas when WebGL can't start. */
class WebGLBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error(error);
  }

  render() {
    return this.state.failed ? (
      <div className="absolute inset-0 grid place-items-center p-6 text-center text-muted">
        The 3D view needs WebGL, which this browser could not start. Switch to 2D in the top bar.
      </div>
    ) : (
      this.props.children
    );
  }
}

/**
 * The section in 3D (React Three Fiber), seen at a fixed angle with the top of
 * the drawing up: same data, callouts, tooltip, selection, pan and zoom as 2D.
 */
export function PipelineDiagram3D({ def, crossings, data, readings, runs, showValues, showTags, selected, onSelect }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const api = useRef<ViewApi | null>(null);
  const callouts = useRef<CalloutRegistry>({ els: new Map(), sizes: new Map() });
  const [hover, setHover] = useState<Hover | null>(null);
  const hoverPart = hover ? def.parts.find((p) => p.tag === hover.tag) : undefined;

  // The scene reports the pointer on the page; the tooltip is placed in the diagram box.
  const onHover = useCallback((h: Hover | null) => {
    const r = wrapRef.current!.getBoundingClientRect();
    setHover(h && { tag: h.tag, x: h.x - r.left, y: h.y - r.top });
  }, []);

  // While the sidebar or info panel slides, the canvas is held at the widest the diagram can get, so it and
  // its render targets are resized once at each end instead of every frame. The field of view is vertical, so
  // the extra width only adds picture at the sides, which the box cuts off; the canvas stays centred in the box.
  useLayoutMotion(() => {
    const host = hostRef.current!;
    const w = Math.max(document.documentElement.clientWidth, host.clientWidth);
    Object.assign(host.style, { left: `calc(50% - ${w / 2}px)`, right: 'auto', width: `${w}px` });
    return () => host.removeAttribute('style');
  });

  // New callout contents: measure them again on the next frame.
  useLayoutEffect(() => {
    callouts.current.sizes.clear();
    api.current?.redraw();
  }, [showValues, showTags, readings]);

  return (
    <div className="relative min-h-0 min-w-0 overflow-hidden bg-page" ref={wrapRef}>
      {/* The canvas fills the box and is centred in it, and the callout layer is pinned to the box's centre, so
          while the canvas is a different size from the box (held during a slide, or a frame behind a resize)
          both stay put. */}
      <div
        className="absolute inset-0 [&_canvas]:absolute [&_canvas]:top-1/2 [&_canvas]:left-1/2 [&_canvas]:-translate-1/2 [&_canvas]:cursor-grab [&_canvas]:touch-none [&_canvas:active]:cursor-grabbing"
        ref={hostRef}
      >
        <WebGLBoundary>
          {/* Tone mapping and antialiasing happen in the scene's post-processing, so the renderer does neither. */}
          <Canvas
            frameloop="demand"
            dpr={[1, 2]}
            shadows="percentage"
            flat
            camera={{ fov: 34, near: 4, far: 12000 }}
            gl={{ antialias: false, powerPreference: 'high-performance' }}
            onCreated={({ camera }) => camera.layers.enable(LABEL_LAYER)}
            onPointerMissed={() => onSelect(null)}
          >
            <PipelineScene
              def={def}
              crossings={crossings}
              data={data}
              readings={readings}
              runs={runs}
              showTags={showTags}
              selected={selected}
              hoverTag={hover?.tag ?? null}
              onSelect={onSelect}
              onHover={onHover}
              callouts={callouts}
              api={api}
            />
          </Canvas>
        </WebGLBoundary>
      </div>

      {/* Callouts are HTML over the canvas; the scene moves each one next to its part every frame and shows it. */}
      <div className="pointer-events-none absolute top-1/2 left-1/2" aria-hidden="true">
        {(showValues || showTags) &&
          def.parts.map((part) => {
            const reading = readings[part.tag];
            const value = showValues ? reading : undefined;
            if (!showTags && !value) return null;
            const accent = reading ? STATUS_COLOR[reading.status] : STATUS_COLOR.idle;
            return (
              <div
                key={part.tag}
                ref={(el) => {
                  if (el) callouts.current.els.set(part.tag, el);
                  else callouts.current.els.delete(part.tag);
                }}
                className="pointer-events-none invisible absolute top-0 left-0 origin-top-left rounded-[3px] border-[0.8px] bg-panel/90 px-1.25 py-[2.5px] text-center font-mono leading-[12.5px] whitespace-nowrap will-change-transform"
                style={{ borderColor: `${accent}80` }}
              >
                {showTags && <div className="text-[9.5px] font-medium text-muted">{part.tag}</div>}
                {value && (
                  <div className="text-[10.5px] font-bold" style={{ color: STATUS_COLOR[value.status] }}>
                    {value.value}
                  </div>
                )}
              </div>
            );
          })}
      </div>

      <DiagramControls zoomIn={() => api.current?.zoomIn()} zoomOut={() => api.current?.zoomOut()} fit={() => api.current?.fit()} />

      {hover && hoverPart && (
        <Tooltip part={hoverPart} hover={hover} wrapWidth={wrapRef.current?.clientWidth ?? 0} reading={readings[hoverPart.tag]} />
      )}
    </div>
  );
}
