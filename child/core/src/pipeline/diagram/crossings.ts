import type { PipeDef, Pt } from './types';

export interface Crossing {
  x: number;
  y: number;
  over: PipeDef;
  under: PipeDef;
  /** The direction the upper pipe runs in, in degrees: 0 is left to right, 90 is down the drawing. */
  overAngle: number;
  /** Sine of the angle between the pipes: 1 where they cross square, less where they cross at a slant. */
  sin: number;
}

const EPS = 0.5;

/**
 * Places where two pipes cross mid-run. They are not connected: the drawing
 * breaks the lower one, and the renderer cuts it away around the upper one.
 * The pipe with the higher z passes over; on a tie, the steeper one does.
 */
export function findCrossings(pipes: PipeDef[]): Crossing[] {
  type Seg = { pipe: PipeDef; a: Pt; d: Pt; len: number };
  const segs: Seg[] = pipes.flatMap((pipe) =>
    pipe.pts.slice(1).map((b, i) => {
      const a = pipe.pts[i];
      const d: Pt = [b[0] - a[0], b[1] - a[1]];
      return { pipe, a, d, len: Math.hypot(d[0], d[1]) };
    }),
  );
  const steepness = (s: Seg) => Math.abs(s.d[1]) / s.len;
  const out: Crossing[] = [];
  segs.forEach((s, i) => {
    for (const t of segs.slice(i + 1)) {
      if (t.pipe === s.pipe || !s.len || !t.len) continue;
      const cross = s.d[0] * t.d[1] - s.d[1] * t.d[0];
      if (Math.abs(cross) < 1e-9) continue; // parallel
      const [wx, wy] = [t.a[0] - s.a[0], t.a[1] - s.a[1]];
      const u = (wx * t.d[1] - wy * t.d[0]) / cross; // how far along s, 0 to 1
      const v = (wx * s.d[1] - wy * s.d[0]) / cross; // how far along t
      // Inside both, clear of their ends: pipes that meet at an end are a junction, not a crossing.
      if (u * s.len <= EPS || (1 - u) * s.len <= EPS || v * t.len <= EPS || (1 - v) * t.len <= EPS) continue;
      const [sz, tz] = [s.pipe.z ?? 0, t.pipe.z ?? 0];
      const [over, under] = (sz !== tz ? sz > tz : steepness(s) >= steepness(t)) ? [s, t] : [t, s];
      out.push({
        x: s.a[0] + s.d[0] * u,
        y: s.a[1] + s.d[1] * u,
        over: over.pipe,
        under: under.pipe,
        overAngle: (Math.atan2(over.d[1], over.d[0]) * 180) / Math.PI,
        sin: Math.abs(cross) / (s.len * t.len),
      });
    }
  });
  return out;
}
