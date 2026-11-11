import { ConeGeometry, Matrix4, Quaternion, TorusGeometry, Vector3, type Group } from 'three';
import { pipeWidth } from '../../view/theme';
import type { Crossing } from '../../model/crossings';
import { isBoxTank } from '../../model/partSpecs';
import type { DiagramDef, Fluid, PartDef, PipeDef, Pt } from '../../model/types';
import { Assembly, BORE, BOX_TANK, PIPE_Y, TANK, Y, dashes, roundCorners, tankReach, toward, trimPath, type Materials } from './kit';

export const pipeRadius = (p: PipeDef) => pipeWidth(p) / 2;

const EPS = 0.5;

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function onSegment(p: Pt, a: Pt, b: Pt): boolean {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.min(1, Math.max(0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2)) : 0;
  return Math.hypot(a[0] + dx * t - p[0], a[1] + dy * t - p[1]) < EPS;
}

/** Where pt lies on a pipe: at one of its ends, somewhere along it, or not on it. */
function placeOn(pt: Pt, pipe: PipeDef): 'end' | 'mid' | null {
  const ends = [pipe.pts[0], pipe.pts[pipe.pts.length - 1]];
  if (ends.some((e) => dist(e, pt) < EPS)) return 'end';
  return pipe.pts.slice(1).some((b, i) => onSegment(pt, pipe.pts[i], b)) ? 'mid' : null;
}

/** Move `to` along the line from `from` until it meets the circle (c, r). Unchanged if the line misses. */
function toCircle(from: Pt, to: Pt, c: Pt, r: number): Pt {
  const len = dist(from, to);
  const u = [(to[0] - from[0]) / len, (to[1] - from[1]) / len];
  const f = [from[0] - c[0], from[1] - c[1]];
  const b = f[0] * u[0] + f[1] * u[1];
  const disc = b * b - (f[0] * f[0] + f[1] * f[1] - r * r);
  if (disc < 0) return to;
  const t = -b - Math.sqrt(disc);
  return [from[0] + u[0] * t, from[1] + u[1] * t];
}

/** Move `to` along the line from `from` until it meets the rectangle centred on c (half sizes hx, hz). Unchanged if the line misses. */
function toRect(from: Pt, to: Pt, c: Pt, hx: number, hz: number): Pt {
  const d = [to[0] - from[0], to[1] - from[1]];
  let [t0, t1] = [-Infinity, Infinity];
  for (const [k, h] of [[0, hx], [1, hz]]) {
    const [lo, hi] = [c[k] - h - from[k], c[k] + h - from[k]];
    if (Math.abs(d[k]) < 1e-9) {
      if (lo > 0 || hi < 0) return to; // runs alongside, clear of it
      continue;
    }
    const [a, b] = [lo / d[k], hi / d[k]];
    t0 = Math.max(t0, Math.min(a, b));
    t1 = Math.min(t1, Math.max(a, b));
  }
  return t0 <= t1 ? [from[0] + d[0] * t0, from[1] + d[1] * t0] : to;
}

/** Whether pt is near enough to the tank to be where a pipe meets it. */
function nearTank(tank: PartDef, pt: Pt): boolean {
  if (!isBoxTank(tank)) return dist(tank.at, pt) < TANK.r + 25;
  return Math.abs(pt[0] - tank.at[0]) < BOX_TANK.w / 2 + 25 && Math.abs(pt[1] - tank.at[1]) < BOX_TANK.d / 2 + 25;
}

/** Where a pipe coming from `from` and ending at `to`, by the tank, meets the tank's wall. */
function tankWall(tank: PartDef, from: Pt, to: Pt): Pt {
  return isBoxTank(tank)
    ? toRect(from, to, tank.at, BOX_TANK.w / 2 - 0.5, BOX_TANK.d / 2 - 0.5)
    : toCircle(from, to, tank.at, TANK.r - 0.5);
}

/**
 * The pipe's centre line in 3D. Where it is the lower pipe at a crossing it
 * drops under the other pipe and comes back up, instead of being broken as in the 2D view.
 */
export function centreLine(pipe: PipeDef, pts: Pt[], crossings: Crossing[]): Vector3[] {
  const r = pipeRadius(pipe);
  const under = crossings.filter((c) => c.under === pipe);
  const out: Vector3[] = [];
  pts.forEach((p, i) => {
    out.push(new Vector3(p[0], PIPE_Y, p[1]));
    const q = pts[i + 1];
    if (!q) return;
    const len = dist(p, q);
    const [ux, uy] = [(q[0] - p[0]) / len, (q[1] - p[1]) / len];
    const here = under
      .map((c) => ({ c, t: (c.x - p[0]) * ux + (c.y - p[1]) * uy, off: (c.y - p[1]) * ux - (c.x - p[0]) * uy }))
      .filter(({ t, off }) => t > 0 && t < len && Math.abs(off) < EPS)
      .sort((a, b) => a.t - b.t);
    for (const { c, t } of here) {
      const over = pipeRadius(c.over);
      const drop = over + r + 5;
      // A slanting crossing takes longer to clear the upper pipe.
      const half = (over + 3) / c.sin + Math.min(r * 2.2, drop / 2);
      const low = PIPE_Y - drop;
      for (const [k, h] of [[-half, PIPE_Y], [-half, low], [half, low], [half, PIPE_Y]]) {
        out.push(new Vector3(p[0] + ux * (t + k), h, p[1] + uy * (t + k)));
      }
    }
  });
  return out;
}

/**
 * Glass pipes: a tinted glass tube (inner and outer wall) around a liquid core.
 * Dashed relief lines are empty glass. Branches stop their glass at the wall of
 * the pipe they join, and each junction gets a glass tee.
 */
export function buildPipes(def: DiagramDef, crossings: Crossing[], mats: Materials): Group {
  const tanks = def.parts.filter((p) => p.kind === 'TK');
  const asm = new Assembly();
  const joints = new Map<string, { at: Pt; r: number; fluid: Fluid }>();

  for (const pipe of def.pipes) {
    const r = pipeRadius(pipe);
    const m = mats.fluid[pipe.fluid];
    const pts = pipe.pts.map((p) => [...p] as Pt);
    const trim = [0, 0];
    const tankEnds: number[] = [];

    for (const end of [0, 1]) {
      const i = end ? pts.length - 1 : 0;
      const j = end ? pts.length - 2 : 1;
      const tank = tanks.find((t) => nearTank(t, pts[i]));
      if (tank) {
        pts[i] = tankWall(tank, pts[j], pts[i]);
        tankEnds.push(end);
        continue;
      }
      for (const other of def.pipes) {
        const place = other === pipe ? null : placeOn(pipe.pts[i], other);
        if (!place) continue;
        if (place === 'mid') trim[end] = Math.max(trim[end], pipeRadius(other) * 0.9);
        if (def.parts.some((p) => dist(p.at, pipe.pts[i]) < 3)) continue;
        const key = pipe.pts[i].join(',');
        const prev = joints.get(key);
        joints.set(key, { at: pipe.pts[i], r: Math.max(prev?.r ?? 0, r, pipeRadius(other)), fluid: other.fluid });
      }
    }

    const path = roundCorners(centreLine(pipe, pts, crossings), r * 2.2);
    if (pipe.dashed) {
      for (const d of dashes(path, 10, 7)) asm.tube(m.glassBack, d, r, 16).tube(m.glassFront, d, r, 16);
    } else {
      // The liquid runs on into the pipe it joins, so branches meet without a seam.
      const shell = trimPath(path, trim[0], trim[1]);
      asm.tube(m.glassBack, shell, r, 24).tube(m.glassFront, shell, r, 24).tube(m.fill, path, r * BORE, 20);
    }

    // A flanged nozzle where the pipe meets a tank.
    for (const end of tankEnds) {
      const [a, b] = end ? path.slice(-2) : [path[1], path[0]];
      const into = b.clone().sub(a).normalize();
      asm.flange(mats.steel, mats.steel, r * 2, 2.4, into, b.clone().addScaledVector(into, -2.2), 4);
      asm.flange(mats.steel, mats.steel, r * 2, 2.4, into, b.clone().addScaledVector(into, -5), 4);
    }

    if (pipe.arrowEnd) {
      const [a, b] = path.slice(-2);
      const dir = b.clone().sub(a).normalize();
      asm.add(m.arrow, new ConeGeometry(5, 10, 18), b.clone().addScaledVector(dir, 5), toward(Y, dir));
    }
  }

  for (const j of joints.values()) {
    const m = mats.fluid[j.fluid];
    const at = new Vector3(j.at[0], PIPE_Y, j.at[1]);
    asm.sphere(m.glassBack, j.r * 1.12, at, undefined, 28).sphere(m.glassFront, j.r * 1.12, at, undefined, 28).sphere(m.fill, j.r * BORE, at, undefined, 24);
  }
  addSupports(asm, def, crossings, mats);
  return asm.build();
}

/** About how far apart the supports under a pipe are. */
const SUPPORT_SPACING = 170;

/**
 * Pipe supports standing on the deck: base plate, post, saddle and a U-bolt
 * over the pipe. Spread evenly along the main and branch lines, clear of parts,
 * tanks, bends, junctions and crossings.
 */
function addSupports(asm: Assembly, def: DiagramDef, crossings: Crossing[], mats: Materials) {
  const placed: Pt[] = [];
  const clear = (p: Pt) =>
    def.parts.every((part) => dist(part.at, p) > (part.kind === 'TK' ? tankReach(part) + 18 : 38)) &&
    crossings.every((c) => dist([c.x, c.y], p) > 34) &&
    def.pipes.every((other) => other.pts.every((q) => dist(q, p) > 26)) &&
    placed.every((q) => dist(q, p) > 30);
  const g = mats.galvanized;

  for (const pipe of def.pipes) {
    if (pipe.dashed || pipe.size === 'small') continue;
    const r = pipeRadius(pipe);
    pipe.pts.slice(1).forEach((b, i) => {
      const a = pipe.pts[i];
      const len = dist(a, b);
      const n = Math.floor(len / SUPPORT_SPACING);
      for (let k = 1; k <= n; k++) {
        const t0 = (len * k) / (n + 1);
        const t = [0, 25, -25, 50, -50].map((d) => t0 + d).find((t) => t > 20 && t < len - 20 && clear(lerp(a, b, t / len)));
        if (t === undefined) continue;
        const p = lerp(a, b, t / len);
        placed.push(p);

        const axis = new Vector3(b[0] - a[0], 0, b[1] - a[1]).normalize();
        const across = new Vector3().crossVectors(Y, axis);
        const alongX = Math.abs(axis.x) > Math.abs(axis.z);
        const under = PIPE_Y - r; // underside of the pipe
        const postH = under - 3.4;
        const [x, z] = p;
        asm.box(g, [14, 1.2, 14], [x, 0.6, z]);
        asm.box(g, [3.4, postH, 3.4], [x, 1.2 + postH / 2, z]);
        asm.box(g, alongX ? [5, 2.2, 2 * r + 7] : [2 * r + 7, 2.2, 5], [x, under - 1.1, z]);
        // U-bolt over the top of the pipe, with its nuts under the saddle.
        const q = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(across, Y, axis));
        asm.add(g, new TorusGeometry(r + 0.7, 0.6, 6, 18, Math.PI), [x, PIPE_Y, z], q);
        for (const s of [-1, 1]) {
          const side = across.clone().multiplyScalar(s * (r + 0.7));
          asm.cyl(g, 0.6, 3.4, Y, [x + side.x, under - 1, z + side.z], 6);
          asm.cyl(g, 1.1, 1.2, Y, [x + side.x, under - 2.8, z + side.z], 6);
        }
      }
    });
  }
}

const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** The pipe that ends at pt, with the direction it leaves in (x/z plane). */
export function pipeEndAt(def: DiagramDef, pt: Pt): { pipe: PipeDef; dir: Vector3 } | undefined {
  for (const pipe of def.pipes) {
    const n = pipe.pts.length;
    for (const [i, j] of [[0, 1], [n - 1, n - 2]]) {
      if (dist(pipe.pts[i], pt) > EPS) continue;
      const [a, b] = [pipe.pts[j], pipe.pts[i]];
      return { pipe, dir: new Vector3(b[0] - a[0], 0, b[1] - a[1]).normalize() };
    }
  }
  return undefined;
}

/** Radius of the pipe passing through or ending at pt. */
export function pipeRadiusAt(def: DiagramDef, pt: Pt, fallback = 5.5): number {
  const rs = def.pipes.filter((p) => placeOn(pt, p)).map(pipeRadius);
  return rs.length ? Math.max(...rs) : fallback;
}
