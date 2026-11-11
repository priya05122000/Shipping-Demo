import { FOCUS_RING } from '../../theme';

/** Small pieces of UI used by several of the piping diagram's components. */

/** A heading over a group of rows in the info panel. */
export const SECTION_TITLE = 'mt-[18px] mb-2 flex items-center gap-2 text-[11px] font-[650] tracking-[0.8px] text-muted uppercase';

/** Name and value pairs, one per line. */
export function Rows({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="text-[13px]">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3 border-b border-panel-2 py-1.5">
          <dt className="text-muted">{k}</dt>
          <dd className="text-right tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A part's tag in a small box. */
export function Chip({ children }: { children: string }) {
  return (
    <span className="inline-block rounded-[5px] border border-line bg-panel-2 px-[7px] py-px font-mono text-[11px] text-ink">{children}</span>
  );
}

const ZOOM_BUTTON = `size-[34px] cursor-pointer rounded-lg border border-line bg-panel/90 leading-none hover:border-accent ${FOCUS_RING}`;

/** The zoom and Fit buttons at the bottom left of a diagram, and the usage hint at the bottom right. */
export function DiagramControls({ zoomIn, zoomOut, fit }: { zoomIn: () => void; zoomOut: () => void; fit: () => void }) {
  return (
    <>
      <div className="absolute bottom-3.5 left-3.5 flex flex-col gap-1.5">
        <button onClick={zoomIn} aria-label="Zoom in" title="Zoom in" className={`${ZOOM_BUTTON} text-[18px]`}>+</button>
        <button onClick={zoomOut} aria-label="Zoom out" title="Zoom out" className={`${ZOOM_BUTTON} text-[18px]`}>−</button>
        <button onClick={fit} aria-label="Fit to screen" title="Fit to screen" className={`${ZOOM_BUTTON} text-[11px] font-[650]`}>Fit</button>
      </div>
      <div className="pointer-events-none absolute right-3.5 bottom-3 text-[11px] text-muted max-wide:hidden">
        Scroll to zoom · drag to pan · click a component for details
      </div>
    </>
  );
}
