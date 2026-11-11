import { useCallback, useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react';

export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

const DRAG_THRESHOLD = 4;

/** Wheel zoom around the cursor, drag to pan, plus zoom/fit helpers for buttons. */
export function useZoomPan(svgRef: RefObject<SVGSVGElement | null>, width: number, height: number) {
  const full: ViewBox = { x: 0, y: 0, w: width, h: height };
  const [vb, setVb] = useState<ViewBox>(full);
  const drag = useRef<{ px: number; py: number; start: ViewBox; scale: number; moved: boolean } | null>(null);
  /** True if the last pointer gesture panned, so the click that follows is ignored. */
  const panned = useRef(false);

  const toSvg = useCallback(
    (clientX: number, clientY: number) => {
      const ctm = svgRef.current?.getScreenCTM();
      if (!ctm) return { x: width / 2, y: height / 2 };
      const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
      return { x: p.x, y: p.y };
    },
    [svgRef, width, height],
  );

  const zoomAt = useCallback(
    (factor: number, at?: { x: number; y: number }) => {
      setVb((v) => {
        const w = Math.min(width * 1.6, Math.max(width / 10, v.w * factor));
        const k = w / v.w;
        const c = at ?? { x: v.x + v.w / 2, y: v.y + v.h / 2 };
        return { x: c.x - (c.x - v.x) * k, y: c.y - (c.y - v.y) * k, w, h: v.h * k };
      });
    },
    [width],
  );

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomAt(Math.exp(e.deltaY * 0.0015), toSvg(e.clientX, e.clientY));
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [svgRef, zoomAt, toSvg]);

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    panned.current = false;
    drag.current = { px: e.clientX, py: e.clientY, start: vb, scale: svgRef.current?.getScreenCTM()?.a ?? 1, moved: false };
  };

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.px;
    const dy = e.clientY - d.py;
    if (!d.moved) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      d.moved = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    setVb({ ...d.start, x: d.start.x - dx / d.scale, y: d.start.y - dy / d.scale });
  };

  const onPointerUp = (e: PointerEvent<SVGSVGElement>) => {
    if (drag.current?.moved) {
      panned.current = true;
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    drag.current = null;
  };

  return {
    vb,
    panned,
    zoomIn: () => zoomAt(1 / 1.3),
    zoomOut: () => zoomAt(1.3),
    fit: () => setVb(full),
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
  };
}
