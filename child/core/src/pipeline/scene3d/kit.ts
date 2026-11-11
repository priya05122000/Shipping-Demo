import {
  BackSide,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  CylinderGeometry,
  Float32BufferAttribute,
  FrontSide,
  Group,
  LatheGeometry,
  MathUtils,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Quaternion,
  RepeatWrapping,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
  Vector3,
  type Material,
  type Side,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FLUID_STYLE, MATERIAL, STATUS_COLOR, UI } from '../components/theme';
import { isBoxTank } from '../diagram/partSpecs';
import { FLUIDS, type Fluid, type PartLayout } from '../diagram/types';
import { beforeNeutral } from './tone';

export const PIPE_Y = 36;
export const TANK = { r: 25, h: 76 };
export const BOX_TANK = { w: 62, d: 50, h: 58 };
export const TREAD_TILE = 8;

/** How far a tank reaches across the deck from its centre. */
export const tankReach = (part: PartLayout) => (isBoxTank(part) ? Math.hypot(BOX_TANK.w, BOX_TANK.d) / 2 : TANK.r);
/** Liquid bore of a glass pipe, as a fraction of its outside radius; the rest is the glass wall. */
export const BORE = 0.84;

export type V3 = [number, number, number];
export const X = new Vector3(1, 0, 0);
export const Y = new Vector3(0, 1, 0);
export const Z = new Vector3(0, 0, 1);

/** Draw order of see-through things: inner glass walls, then liquid, then outer glass walls, then overlays. */
export const ORDER = { back: 1, liquid: 2, front: 3, overlay: 4 } as const;

const vec = (v: V3 | Vector3) => (Array.isArray(v) ? new Vector3(...v) : v.clone());
export const toward = (from: Vector3, to: Vector3) => new Quaternion().setFromUnitVectors(from, to.clone().normalize());

/** Any unit vector at right angles to axis. */
export function perpendicular(axis: Vector3): Vector3 {
  const t = Math.abs(axis.y) < 0.9 ? Y : X;
  return new Vector3().crossVectors(t, axis).normalize();
}

// ── Materials ───────────────────────────────────────────────────────────────

function layer<M extends Material>(m: M, order: number): M {
  m.userData.order = order;
  return m;
}

function denserAtEdges<M extends Material>(m: M, face: number, edge: number): M {
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `#include <opaque_fragment>
      float rim = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 2.0);
      gl_FragColor.a = clamp(gl_FragColor.a * (${face.toFixed(2)} + ${edge.toFixed(2)} * rim), 0.0, 1.0);`,
    );
  };
  return m;
}

/** Thin glass; `face` is how much of its opacity it keeps where you look straight through it. */
function glass(color: string, opacity: number, side: Side, face = 0.4) {
  const m = new MeshPhysicalMaterial({
    color,
    transparent: true,
    opacity,
    side,
    depthWrite: false,
    roughness: 0.06,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.6,
  });
  return denserAtEdges(m, face, 2.4);
}

function clearLiquid(color: string, opacity: number) {
  return new MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
}

function fluidMaterials(f: Fluid) {
  const s = FLUID_STYLE[f];
  const liquid = (color: string, opacity: number) =>
    layer(
      new MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.3, roughness: 0.25, transparent: true, opacity, depthWrite: false }),
      ORDER.liquid,
    );
  return {
    glassBack: layer(glass(MATERIAL.pipeGlass, 0.1, BackSide, 0.25), ORDER.back),
    glassFront: layer(glass(MATERIAL.pipeGlass, 0.2, FrontSide, 0.25), ORDER.front),
    fill: layer(clearLiquid(s.rim, 0.5), ORDER.liquid),
    tankFill: layer(clearLiquid(s.rim, 0.8), ORDER.liquid),
    liquid: liquid(s.liquid, 0.55),
    surface: liquid(s.liquidHi, 0.85),
    arrow: layer(new MeshStandardMaterial({ color: s.rim, roughness: 0.3, transparent: true, opacity: 0.85, depthWrite: false }), ORDER.front),
  };
}

export type FluidMaterials = ReturnType<typeof fluidMaterials>;

function treadTexture(): CanvasTexture {
  const S = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const g = canvas.getContext('2d')!;
  g.fillStyle = MATERIAL.boxTank.tread;
  for (const [x, y, turn] of [[0.25, 0.25, 1], [0.75, 0.75, 1], [0.75, 0.25, -1], [0.25, 0.75, -1]]) {
    g.beginPath();
    g.ellipse(x * S, y * S, S * 0.15, S * 0.035, (turn * Math.PI) / 4, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

export function createMaterials() {
  const solid = (color: string, roughness: number, metalness: number) => new MeshStandardMaterial({ color, roughness, metalness });
  const paint = (color: string) => new MeshPhysicalMaterial({ color, roughness: 0.5, metalness: 0.05, clearcoat: 0.6, clearcoatRoughness: 0.28 });
  const mark = (color: string, opacity: number) =>
    layer(new MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }), ORDER.overlay);
  const tankGlass = (tint: string) => ({
    back: layer(glass(tint, 0.06, BackSide), ORDER.back),
    front: layer(glass(tint, 0.12, FrontSide), ORDER.front),
  });
  const tex = treadTexture();
  const tread = (side: Side, order: number) =>
    layer(
      new MeshStandardMaterial({ map: tex, bumpMap: tex, bumpScale: 2, transparent: true, side, depthWrite: false, roughness: 0.4, metalness: 0.6 }),
      order,
    );
  return {
    red: paint(MATERIAL.red),
    blue: paint(MATERIAL.blue),
    steel: solid(MATERIAL.steel, 0.28, 1),
    darkSteel: solid(MATERIAL.darkSteel, 0.42, 0.85),
    galvanized: solid(MATERIAL.galvanized, 0.55, 0.9),
    blind: solid(MATERIAL.blind, 0.45, 0.7),
    brass: solid(MATERIAL.brass, 0.3, 0.9),
    rubber: solid(MATERIAL.rubber, 0.8, 0.05),
    ledOn: new MeshStandardMaterial({ color: STATUS_COLOR.open, emissive: STATUS_COLOR.open, emissiveIntensity: 1.6, roughness: 0.3 }),
    ledOff: solid(STATUS_COLOR.closed, 0.5, 0.2),
    tankRim: { blue: paint(MATERIAL.tankRim.blue), red: paint(MATERIAL.tankRim.red) },
    tankGlass: { blue: tankGlass(MATERIAL.tankGlass.blue), red: tankGlass(MATERIAL.tankGlass.red) },
    boxTank: {
      paint: paint(MATERIAL.boxTank.paint),
      glass: tankGlass(MATERIAL.boxTank.glass),
      tread: { back: tread(BackSide, ORDER.back), front: tread(FrontSide, ORDER.front) },
    },
    levelMark: mark(MATERIAL.clear, 0.6),
    highMark: mark(STATUS_COLOR.warn, 0.9),
    highHighMark: mark(STATUS_COLOR.alarm, 0.9),
    gaugeGlass: layer(glass(MATERIAL.clear, 0.12, FrontSide), ORDER.front),
    deckLine: new MeshBasicMaterial({ color: beforeNeutral(UI.muted), transparent: true, opacity: 0.6, depthWrite: false }),
    fluid: Object.fromEntries(FLUIDS.map((f) => [f, fluidMaterials(f)])) as Record<Fluid, FluidMaterials>,
  };
}

export type Materials = ReturnType<typeof createMaterials>;

export class Assembly {
  private byMat = new Map<Material, BufferGeometry[]>();

  add(mat: Material, geo: BufferGeometry, at: V3 | Vector3 = [0, 0, 0], q = new Quaternion(), scale: V3 = [1, 1, 1]): this {
    geo.applyMatrix4(new Matrix4().compose(vec(at), q, new Vector3(...scale)));
    const list = this.byMat.get(mat);
    if (list) list.push(geo);
    else this.byMat.set(mat, [geo]);
    return this;
  }

  cyl(mat: Material, r: number, len: number, axis: Vector3, at: V3 | Vector3, seg = 24, rEnd = r): this {
    return this.add(mat, new CylinderGeometry(rEnd, r, len, seg), at, toward(Y, axis));
  }

  box(mat: Material, size: V3, at: V3 | Vector3): this {
    return this.add(mat, new BoxGeometry(...size), at);
  }

  sphere(mat: Material, r: number, at: V3 | Vector3, scale?: V3, seg = 20): this {
    return this.add(mat, new SphereGeometry(r, seg, Math.ceil(seg * 0.7)), at, undefined, scale);
  }

  /** Ring of radius R around axis. */
  torus(mat: Material, R: number, tube: number, axis: Vector3, at: V3 | Vector3, seg = 32): this {
    return this.add(mat, new TorusGeometry(R, tube, 10, seg), at, toward(Z, axis));
  }

  tube(mat: Material, pts: Vector3[], r: number, seg = 12): this {
    return pts.length > 1 ? this.add(mat, sweepTube(pts, r, seg)) : this;
  }

  /** A turned shape around axis: profile is [radius, position along the axis] pairs, centred on at. */
  lathe(mat: Material, profile: [number, number][], axis: Vector3, at: V3 | Vector3, seg = 32): this {
    return this.add(mat, new LatheGeometry(profile.map(([r, h]) => new Vector2(r, h)), seg), at, toward(Y, axis));
  }

  /** A flange: plate, raised hub, and n studs with a hex nut on each face. */
  flange(mat: Material, steel: Material, R: number, thick: number, axis: Vector3, at: V3 | Vector3, n = 4): this {
    const c = vec(at);
    const ring = R * 0.78;
    const stud = Math.max(0.5, R * 0.07);
    this.cyl(mat, R, thick, axis, c, 36);
    this.cyl(mat, R * 0.64, thick + 1.4, axis, c, 30);
    this.bolts(steel, n, ring, axis, c, stud, thick + 3.2);
    for (const s of [-1, 1]) this.bolts(steel, n, ring, axis, c.clone().addScaledVector(axis, s * (thick / 2 + 0.6)), stud * 1.9, 1.2);
    return this;
  }

  /** Handwheel facing along axis: rim, spokes and hub. */
  wheel(mat: Material, R: number, axis: Vector3, at: V3 | Vector3, spokes = 4): this {
    const c = vec(at);
    const u = perpendicular(axis);
    const v = new Vector3().crossVectors(axis, u).normalize();
    this.torus(mat, R, R * 0.13, axis, c);
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * Math.PI * 2 + Math.PI / 4;
      const d = u.clone().multiplyScalar(Math.cos(a)).addScaledVector(v, Math.sin(a));
      this.cyl(mat, R * 0.07, R, d, c.clone().addScaledVector(d, R / 2), 8);
    }
    return this.cyl(mat, R * 0.2, R * 0.3, axis, c, 16);
  }

  /** n studs on a circle of radius ringR around axis, centred on at. */
  bolts(mat: Material, n: number, ringR: number, axis: Vector3, at: V3 | Vector3, r: number, len: number): this {
    const c = vec(at);
    const u = perpendicular(axis);
    const v = new Vector3().crossVectors(axis, u).normalize();
    for (let i = 0; i < n; i++) {
      const a = ((i + 0.5) / n) * Math.PI * 2;
      this.cyl(mat, r, len, axis, c.clone().addScaledVector(u, Math.cos(a) * ringR).addScaledVector(v, Math.sin(a) * ringR), 6);
    }
    return this;
  }

  build(): Group {
    const g = new Group();
    for (const [mat, geos] of this.byMat) {
      const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos);
      if (!merged) throw new Error('Assembly: shapes could not be merged');
      if (geos.length > 1) for (const geo of geos) geo.dispose();
      const mesh = new Mesh(merged, mat);
      mesh.renderOrder = mat.userData.order ?? 0;
      // Everything casts a shadow from the sun, glass and liquid too; only solid surfaces take
      // them, as on a see-through layer a shadow would show through as a dark smear.
      mesh.castShadow = true;
      mesh.receiveShadow = !mat.transparent;
      g.add(mesh);
    }
    this.byMat.clear();
    return g;
  }
}

// ── Paths ───────────────────────────────────────────────────────────────────

function dedupe(pts: Vector3[]): Vector3[] {
  return pts.filter((p, i) => i === 0 || p.distanceToSquared(pts[i - 1]) > 1e-8);
}

/** Tube along a polyline. Rings are carried along with parallel-transport frames, so bends don't twist. */
export function sweepTube(points: Vector3[], r: number, radial = 16): BufferGeometry {
  const pts = dedupe(points);
  const n = pts.length;
  const tangents = pts.map((_, i) => pts[Math.min(n - 1, i + 1)].clone().sub(pts[Math.max(0, i - 1)]).normalize());
  const normal = perpendicular(tangents[0]);
  const binormal = new Vector3();
  const dir = new Vector3();
  const axis = new Vector3();
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  let along = 0;

  for (let i = 0; i < n; i++) {
    if (i > 0) {
      axis.crossVectors(tangents[i - 1], tangents[i]);
      const s = axis.length();
      if (s > 1e-6) normal.applyAxisAngle(axis.divideScalar(s), Math.acos(MathUtils.clamp(tangents[i - 1].dot(tangents[i]), -1, 1)));
      normal.addScaledVector(tangents[i], -normal.dot(tangents[i])).normalize();
      along += pts[i].distanceTo(pts[i - 1]);
    }
    binormal.crossVectors(tangents[i], normal);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      dir.copy(normal).multiplyScalar(-Math.cos(a)).addScaledVector(binormal, Math.sin(a));
      pos.push(pts[i].x + dir.x * r, pts[i].y + dir.y * r, pts[i].z + dir.z * r);
      nor.push(dir.x, dir.y, dir.z);
      uv.push(j / radial, along);
    }
  }
  for (let i = 1; i < n; i++) {
    for (let j = 1; j <= radial; j++) {
      const a = (radial + 1) * (i - 1) + (j - 1);
      const b = (radial + 1) * i + (j - 1);
      const c = (radial + 1) * i + j;
      const d = (radial + 1) * (i - 1) + j;
      idx.push(a, b, d, b, c, d);
    }
  }
  const geo = new BufferGeometry();
  geo.setIndex(idx);
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  return geo;
}

/** Replace each bend of a polyline with an arc of radius up to `radius` (less where the legs are short). */
export function roundCorners(pts: Vector3[], radius: number, steps = 7): Vector3[] {
  if (pts.length < 3) return pts.map((p) => p.clone());
  const out = [pts[0].clone()];
  for (let i = 1; i < pts.length - 1; i++) {
    const [p, v, n] = [pts[i - 1], pts[i], pts[i + 1]];
    const d1 = v.clone().sub(p);
    const d2 = n.clone().sub(v);
    const l1 = d1.length();
    const l2 = d2.length();
    d1.divideScalar(l1);
    d2.divideScalar(l2);
    const turn = Math.acos(MathUtils.clamp(d1.dot(d2), -1, 1));
    if (turn < 1e-3) continue;
    const t = Math.min(radius * Math.tan(turn / 2), l1 / 2, l2 / 2);
    const a = v.clone().addScaledVector(d1, -t);
    const b = v.clone().addScaledVector(d2, t);
    for (let s = 0; s <= steps; s++) {
      const u = s / steps;
      out.push(a.clone().multiplyScalar((1 - u) ** 2).addScaledVector(v, 2 * u * (1 - u)).addScaledVector(b, u * u));
    }
  }
  out.push(pts[pts.length - 1].clone());
  return dedupe(out);
}

function trimStart(pts: Vector3[], d: number): Vector3[] {
  for (let i = 0; i < pts.length - 1; i++) {
    const len = pts[i].distanceTo(pts[i + 1]);
    if (d < len) return [pts[i].clone().lerp(pts[i + 1], d / len), ...pts.slice(i + 1)];
    d -= len;
  }
  return pts.slice(-1);
}

/** The path with `start` units cut off its start and `end` units off its end. */
export function trimPath(pts: Vector3[], start: number, end: number): Vector3[] {
  let out = pts;
  if (start > 0) out = trimStart(out, start);
  if (end > 0) out = trimStart([...out].reverse(), end).reverse();
  return out;
}

/** Split a path into dashes, like an SVG stroke-dasharray. */
export function dashes(pts: Vector3[], dash: number, gap: number): Vector3[][] {
  const out: Vector3[][] = [];
  let cur = [pts[0].clone()];
  let on = true;
  let left = dash;
  for (let i = 0; i < pts.length - 1; i++) {
    const [a, b] = [pts[i], pts[i + 1]];
    const len = a.distanceTo(b);
    let at = 0;
    while (len - at > left) {
      at += left;
      const p = a.clone().lerp(b, at / len);
      if (on) out.push([...cur, p]);
      else cur = [p];
      on = !on;
      left = on ? dash : gap;
    }
    left -= len - at;
    if (on) cur.push(b.clone());
  }
  if (on && cur.length > 1) out.push(cur);
  return out.map(dedupe).filter((d) => d.length > 1);
}
