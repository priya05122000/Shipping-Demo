import {
  CanvasTexture,
  CatmullRomCurve3,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  MeshStandardMaterial,
  Path,
  PlaneGeometry,
  Quaternion,
  Shape,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
  type Material,
  type Mesh,
} from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { GAUGE, UI } from '../../view/theme';
import type { Reading } from '../../data/readings';
import type { SectionData, TankData } from '../../data/sectionData';
import { GAUGE_RADIUS, isBoxTank } from '../../model/partSpecs';
import type { DiagramDef, PartDef, PartKind } from '../../model/types';
import { Assembly, BORE, BOX_TANK, PIPE_Y, TANK, TREAD_TILE, X, Y, Z, dashes, roundCorners, toward, type Materials, type V3 } from './kit';
import { flatText } from './labels';
import { pipeEndAt, pipeRadius } from './pipes';

/*
 * Each part is modelled after its reference-sheet image, in a local frame:
 * the pipe runs along x, y is up and the origin is on the pipe centre line.
 * Sizes follow the image sizes in partSpecs.ts.
 */

export interface PartContext {
  mats: Materials;
  data: SectionData;
  reading?: Reading;
  /** Radius of the pipe the part sits on. */
  pipeR: number;
}

/** Parts that turn with their pipe (rot / flip). Tanks and gauges are modelled in place. */
const FOLLOWS_PIPE: ReadonlySet<PartKind> = new Set(['BFV', 'PSV', 'GLV', 'BV', 'HV', 'MBV', 'DJ', 'MC', 'NRV', 'PU', 'FL']);

export function buildPart(part: PartDef, ctx: PartContext): Group {
  const { mats: m, data, pipeR } = ctx;
  const a = new Assembly();
  const rot = ((part.rot ?? 0) * Math.PI) / 180;
  // The local direction that ends up facing the default view (+z), for gear-operator handwheels.
  const face = new Vector3((part.flip ? -1 : 1) * Math.sin(rot), 0, Math.cos(rot));

  let led: V3 | undefined;
  switch (part.kind) {
    case 'BFV':
      led = butterflyValve(a, m, pipeR, face, false);
      break;
    case 'MBV':
      led = butterflyValve(a, m, pipeR, face, true);
      break;
    case 'GLV':
      led = globeValve(a, m, pipeR);
      break;
    case 'BV':
      led = ballValve(a, m, data.valves[part.tag]?.open === true);
      break;
    case 'HV':
      led = hydrantValve(a, m);
      break;
    case 'PSV':
      led = reliefValve(a, m, pipeR);
      break;
    case 'DJ':
      dismantlingJoint(a, m, pipeR);
      break;
    case 'TK':
      (isBoxTank(part) ? boxTank : tank)(a, m, part, ctx.reading?.num ?? 0, data.tanks[part.tag]);
      break;
    case 'PI':
      gauge(a, m, ctx.reading?.num ?? 0, data.gauges[part.tag]?.maxBar ?? 16);
      break;
    case 'MC':
      hoseConnection(a, m, part.hoseDir ?? -1, data.hoses[part.tag]?.connected === true);
      break;
    case 'NRV':
      led = checkValve(a, m, pipeR);
      break;
    case 'PU':
      led = pump(a, m, pipeR);
      break;
    case 'FL':
      filter(a, m, pipeR);
      break;
  }
  // Valves show open or closed, pumps running or stopped.
  if (led) a.sphere(ctx.reading?.status === 'open' ? m.ledOn : m.ledOff, 1.8, led, undefined, 12);

  const g = a.build();
  g.position.set(part.at[0], part.kind === 'TK' ? 0 : PIPE_Y, part.at[1]);
  if (FOLLOWS_PIPE.has(part.kind)) {
    g.rotation.y = -rot;
    if (part.flip) g.scale.x = -1;
  }
  g.traverse((o) => (o.userData.tag = part.tag));
  return g;
}

/** [1] and [6]: wafer butterfly valve with a gear operator; the manifold valve [6] is the lugged kind. Returns the LED position. */
function butterflyValve(a: Assembly, m: Materials, pr: number, face: Vector3, lugged: boolean): V3 {
  const R = lugged ? Math.max(pr * 2.1, 12) : Math.max(pr * 1.75, 9.5);
  const T = lugged ? 8 : 6;
  a.cyl(m.red, R, T, X, [0, 0, 0], 36);
  // The seat liner shows blue at both faces.
  for (const s of [-1, 1]) a.cyl(m.blue, R * 0.96, 1.2, X, [s * (T / 2 + 0.5), 0, 0], 36);
  if (lugged) {
    for (let i = 0; i < 6; i++) {
      const ang = ((i + 0.5) / 6) * Math.PI * 2;
      const p: V3 = [0, Math.cos(ang) * (R + 1.2), Math.sin(ang) * (R + 1.2)];
      a.cyl(m.red, 2.4, T + 1, X, p, 12);
    }
  }
  // Fitted as on a real line: clamped between two pipe flanges by long studs outside the body.
  const flangeR = R + (lugged ? 4 : 3.2);
  const studRing = R + (lugged ? 1.2 : 1.6);
  for (const s of [-1, 1]) {
    a.cyl(m.steel, flangeR, 2.4, X, [s * (T / 2 + 2.4), 0, 0], 40);
    a.cyl(m.steel, R * 0.7, 6, X, [s * (T / 2 + 5), 0, 0], 32);
    a.bolts(m.steel, 6, studRing, X, [s * (T / 2 + 4.2), 0, 0], 1.5, 1.4);
  }
  a.bolts(m.steel, 6, studRing, X, [0, 0, 0], 0.75, T + 10);
  const top = R + (lugged ? 2.5 : 0.5);
  const gearbox = new Vector3(0, top + 9, 0);
  a.cyl(m.red, 2.4, 6, Y, [0, top + 2, 0], 16);
  a.cyl(m.blue, 4.6, 1.6, Y, [0, top + 4.6, 0], 20);
  a.box(m.red, [8, 8, 8], gearbox);
  a.cyl(m.steel, 1.3, 8, face, gearbox.clone().addScaledVector(face, 4), 10);
  a.wheel(m.blue, R * 0.78, face, gearbox.clone().addScaledVector(face, 8));
  return [-face.x * 2, gearbox.y + 4.8, -face.z * 2];
}

/** [3] globe valve: flanged globe body, bonnet, yoke and a handwheel on top. */
function globeValve(a: Assembly, m: Materials, pr: number): V3 {
  const fr = Math.max(pr * 2.1, 7.5);
  for (const s of [-1, 1]) a.flange(m.blue, m.steel, fr, 2.6, X, [s * 12.5, 0, 0]);
  // Cast body: the necks swell into the globe.
  a.lathe(m.red, [[4.2, -11.5], [4.4, -9], [5.4, -6.5], [7.2, -4], [7.9, -1.5], [7.9, 1.5], [7.2, 4], [5.4, 6.5], [4.4, 9], [4.2, 11.5]], X, [0, 0, 0]);
  a.lathe(m.red, [[6.2, 4], [5.6, 7], [4.8, 9], [4.6, 10.6]], Y, [0, 0, 0], 24);
  a.cyl(m.blue, 6.4, 2, Y, [0, 11.5, 0], 6);
  a.cyl(m.red, 4.2, 3, Y, [0, 14, 0], 20);
  for (const s of [-1, 1]) a.cyl(m.red, 0.9, 8, Y, [s * 3.2, 19.5, 0], 8);
  a.box(m.red, [8.2, 1.8, 3], [0, 23.6, 0]);
  a.cyl(m.brass, 1.05, 15, Y, [0, 20, 0], 10);
  a.wheel(m.blue, 9.5, Y, [0, 27.2, 0], 5);
  return [5.2, 14, 3.2];
}

/** [4] ball valve. The lever lies along the pipe when open and across it when closed, as on a real one. */
function ballValve(a: Assembly, m: Materials, open: boolean): V3 {
  a.lathe(m.red, [[5.2, -8], [5.6, -6], [7.3, -3.5], [7.9, 0], [7.3, 3.5], [5.6, 6], [5.2, 8]], X, [0, 0, 0]);
  for (const s of [-1, 1]) {
    a.cyl(m.blue, 6.2, 7, X, [s * 11, 0, 0], 6);
    a.cyl(m.steel, 4.6, 1.6, X, [s * 15.2, 0, 0], 20); // threaded end
  }
  a.cyl(m.red, 2.8, 4, Y, [0, 8, 0], 16);
  a.cyl(m.steel, 2.6, 2.2, Y, [0, 10.6, 0], 6);
  a.cyl(m.steel, 1, 3, Y, [0, 12.6, 0], 8);
  const d = open ? X : Z;
  a.box(m.steel, [5, 1.6, 5], [0, 13.6, 0]);
  a.box(m.blue, open ? [26, 1.3, 2.8] : [2.8, 1.3, 26], [d.x * 15, 13.6, d.z * 15]);
  a.box(m.blue, open ? [6, 2.4, 3.4] : [3.4, 2.4, 6], [d.x * 27, 13.6, d.z * 27]);
  return [-7, 8.5, 3.8];
}

/** [5] hydrant / landing valve: inlet flange on the pipe end, globe body, hose coupling and a dish handwheel. */
function hydrantValve(a: Assembly, m: Materials): V3 {
  a.flange(m.blue, m.steel, 8.5, 3, X, [1.5, 0, 0]);
  a.lathe(m.red, [[4.4, 3], [4.8, 6], [7.2, 9], [8.8, 12.5], [8.8, 15.5], [7.6, 19], [5.2, 22], [4.2, 25], [4.2, 28.5]], X, [0, 0, 0]);
  a.cyl(m.blue, 5.6, 6, X, [30, 0, 0], 8);
  for (const s of [-1, 1]) a.cyl(m.blue, 1.4, 4, Y, [30, s * 6.5, 0], 10);
  a.cyl(m.blue, 4.2, 1.5, X, [33.7, 0, 0], 20);
  a.cyl(m.red, 6.2, 4, Y, [14, 9, 0], 6);
  a.cyl(m.steel, 3.6, 3, Y, [14, 12.5, 0], 6);
  a.cyl(m.steel, 1.1, 9, Y, [14, 17.5, 0], 10);
  a.cyl(m.blue, 10.5, 2.2, Y, [14, 22, 0], 36);
  a.cyl(m.steel, 0.9, 2, Y, [14, 24, 0], 8);
  return [6, 6.5, 5];
}

/** [2] safety relief valve: flanged body, open spring bonnet, cap and lifting lever. */
function reliefValve(a: Assembly, m: Materials, pr: number): V3 {
  for (const s of [-1, 1]) a.flange(m.blue, m.steel, 7, 2.4, X, [s * 10.5, 0, 0]);
  const neck = Math.max(pr * 1.15, 3.9);
  a.lathe(m.red, [[neck, -9.5], [neck + 0.3, -7], [5.6, -4.5], [6.6, -1.5], [6.6, 1.5], [5.6, 4.5], [neck + 0.3, 7], [neck, 9.5]], X, [0, 0, 0]);
  a.lathe(m.red, [[5.6, 3], [5.2, 6], [4.8, 9]], Y, [0, 0, 0], 24);
  a.cyl(m.blue, 6, 1.6, Y, [0, 9.6, 0], 20);
  for (const s of [-1, 1]) a.cyl(m.red, 0.95, 13, Y, [s * 4.1, 16.9, 0], 8);
  a.cyl(m.steel, 0.8, 14, Y, [0, 17, 0], 8);
  const coil: Vector3[] = [];
  for (let i = 0; i <= 140; i++) {
    const t = i / 140;
    const ang = t * 7 * Math.PI * 2;
    coil.push(new Vector3(Math.cos(ang) * 2.9, 10.8 + t * 12, Math.sin(ang) * 2.9));
  }
  a.tube(m.steel, coil, 0.55, 6);
  a.cyl(m.red, 4.6, 2.6, Y, [0, 24.6, 0], 20);
  a.cyl(m.blue, 3.2, 4, Y, [0, 27.9, 0], 16);
  a.sphere(m.blue, 1.5, [0, 30.2, 0], undefined, 12);
  a.tube(m.blue, roundCorners([new Vector3(1.6, 29, 0), new Vector3(6.5, 28, 0), new Vector3(11, 21.5, 0)], 3), 0.85, 8);
  a.sphere(m.blue, 1.7, [11, 21.2, 0], undefined, 12);
  return [-6.5, 7.5, 3.6];
}

/** [7] dismantling joint: blue end flanges, red spool and sleeve, tie rods. */
function dismantlingJoint(a: Assembly, m: Materials, pr: number) {
  const R = Math.max(pr * 1.85, 9.5);
  for (const s of [-1, 1]) {
    a.flange(m.blue, m.steel, R, 3.2, X, [s * 25, 0, 0], 8);
    a.cyl(m.red, R * 0.9, 2.6, X, [s * 19, 0, 0], 36);
  }
  a.cyl(m.red, pr * 1.3, 36, X, [0, 0, 0], 28);
  // The sleeve slides over the spool; its ends taper like a cast gland.
  a.lathe(m.red, [[pr * 1.35, -3], [pr * 1.65, -1.5], [pr * 1.65, 9.5], [pr * 1.35, 11]], X, [0, 0, 0], 28);
  for (let i = 0; i < 4; i++) {
    const ang = ((i + 0.5) / 4) * Math.PI * 2;
    const [py, pz] = [Math.cos(ang) * R * 0.8, Math.sin(ang) * R * 0.8];
    a.cyl(m.steel, 0.75, 56, X, [0, py, pz], 8);
    for (const s of [-1, 1]) a.cyl(m.steel, 1.5, 1.8, X, [s * 27.5, py, pz], 6);
  }
}

/**
 * [8] / [9] glass tank standing on the deck: coloured rims, a glass top head to look in through,
 * liquid at its level, level ticks and alarm rings.
 */
function tank(a: Assembly, m: Materials, part: PartDef, level: number, td: TankData | undefined) {
  const { r: R, h: H } = TANK;
  const color = part.tankColor ?? 'blue';
  const paint = m.tankRim[color];
  const [f0, f1] = [12, H - 12]; // flange rings holding the glass
  const [g0, g1] = [f0 + 2.4, f1 - 2.4]; // glass from, to
  const gh = g1 - g0;
  // Legs with foot plates under a dished bottom head.
  for (let i = 0; i < 4; i++) {
    const ang = ((i + 0.5) / 4) * Math.PI * 2;
    const [lx, lz] = [Math.cos(ang) * (R - 7), Math.sin(ang) * (R - 7)];
    a.cyl(m.steel, 1.6, 7, Y, [lx, 3.5, lz], 12);
    a.cyl(m.steel, 3.2, 0.8, Y, [lx, 0.4, lz], 16);
  }
  a.add(paint, new SphereGeometry(R + 1, 48, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), [0, f0 - 2.5, 0], undefined, [1, 0.2, 1]);
  a.cyl(paint, R + 1, 2.5, Y, [0, f0 - 1.25, 0], 48); // head skirt
  a.cyl(paint, R + 4, 2.4, Y, [0, f0 + 1.2, 0], 48); // flange ring
  // The top flange is a ring round the opening, so the glass head above it shows the inside.
  a.lathe(paint, washer(R, R + 4, 2.4), Y, [0, f1 - 1.2, 0], 48);
  // Vent on the top head.
  a.cyl(m.steel, 2.2, 5, Y, [0, H - 1, 0], 16);
  a.cyl(m.steel, 4, 1.4, Y, [0, H + 1.6, 0], 20);
  // Tie rods between the flange rings, clear of where the pipes come in.
  for (let i = 0; i < 4; i++) {
    const ang = ((i + 0.5) / 4) * Math.PI * 2;
    const [rx, rz] = [Math.cos(ang) * (R + 2.6), Math.sin(ang) * (R + 2.6)];
    a.cyl(m.steel, 0.8, gh, Y, [rx, (g0 + g1) / 2, rz], 10);
    for (const y of [g0 + 0.7, g1 - 0.7]) a.cyl(m.steel, 1.5, 1.4, Y, [rx, y, rz], 6);
  }
  for (const side of [m.tankGlass[color].back, m.tankGlass[color].front]) {
    a.add(side, new CylinderGeometry(R, R, gh, 64, 1, true), [0, (g0 + g1) / 2, 0]);
    // The top head and its skirt.
    a.add(side, new SphereGeometry(R + 1, 48, 10, 0, Math.PI * 2, 0, Math.PI / 2), [0, f1 + 2.5, 0], undefined, [1, 0.24, 1]);
    a.add(side, new CylinderGeometry(R + 1, R + 1, 2.5, 48, 1, true), [0, f1 + 1.25, 0]);
  }

  const fill = Math.min(1, Math.max(0, level / 100)) * gh;
  const fm = m.fluid[part.fluid];
  if (fill > 0.3) {
    a.cyl(fm.tankFill, R - 0.8, fill, Y, [0, g0 + fill / 2, 0], 64);
    a.torus(fm.surface, R - 1.2, 0.45, Y, [0, g0 + fill, 0], 64); // meniscus
  }
  for (const pct of [25, 50, 75]) a.box(m.levelMark, [7, 0.5, 0.5], [0, g0 + (gh * pct) / 100, R + 0.4]);
  if (td) {
    a.torus(m.highMark, R + 0.4, 0.35, Y, [0, g0 + (gh * td.highPct) / 100, 0], 48);
    a.torus(m.highHighMark, R + 0.4, 0.35, Y, [0, g0 + (gh * td.highHighPct) / 100, 0], 48);
  }
}

/**
 * Box tank after the photo of a chequer-plate tank, made see-through: clear plates with a raised tread,
 * folded edges, a lifting lug at each top corner and three nozzles on top (an open vent and two capped
 * connections). It stands on two skids, with the liquid at its level, level ticks and alarm bands.
 */
function boxTank(a: Assembly, m: Materials, part: PartDef, level: number, td: TankData | undefined) {
  const { w, d, h: H } = BOX_TANK;
  const b = m.boxTank;
  const [hw, hd] = [w / 2, d / 2];
  const y0 = 3; // underside, on the skids
  const [yc, hs] = [(y0 + H) / 2, H - y0];
  for (const z of [-hd + 8, hd - 8]) a.box(m.darkSteel, [w - 4, y0, 6], [0, y0 / 2, z]);
  a.box(b.paint, [w, 0.8, d], [0, y0 + 0.4, 0]);

  // The sides and the top plate, each facing out. The tread shows on the near plates and, through the
  // liquid, on the inside of the far ones.
  const turn = (axis: Vector3, angle: number) => new Quaternion().setFromAxisAngle(axis, angle);
  const plates = (): [PlaneGeometry, V3, Quaternion][] => [
    [plate(w, hs), [0, yc, hd], new Quaternion()],
    [plate(w, hs), [0, yc, -hd], turn(Y, Math.PI)],
    [plate(d, hs), [hw, yc, 0], turn(Y, Math.PI / 2)],
    [plate(d, hs), [-hw, yc, 0], turn(Y, -Math.PI / 2)],
    [plate(w, d), [0, H, 0], turn(X, -Math.PI / 2)],
  ];
  for (const mat of [b.glass.back, b.glass.front, b.tread.back, b.tread.front]) {
    for (const [geo, at, q] of plates()) a.add(mat, geo, at, q);
  }

  // Folded edges, rounded at the corners.
  const e = 1.1;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      a.cyl(b.paint, e, hs, Y, [sx * hw, yc, sz * hd], 12);
      for (const y of [y0, H]) a.sphere(b.paint, e, [sx * hw, y, sz * hd], undefined, 12);
    }
  }
  for (const y of [y0, H]) {
    for (const s of [-1, 1]) {
      a.cyl(b.paint, e, w, X, [0, y, s * hd], 12);
      a.cyl(b.paint, e, d, Z, [s * hw, y, 0], 12);
    }
  }

  // Lifting lugs: a rounded plate with an eye, standing up from each top corner along its diagonal.
  const lug = new Shape().moveTo(-3, -2.5).lineTo(3, -2.5).lineTo(3, 2.5).absarc(0, 2.5, 3, 0, Math.PI, false).lineTo(-3, -2.5);
  lug.holes.push(new Path().absarc(0, 2.5, 1.2, 0, Math.PI * 2, true));
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const geo = mergeVertices(new ExtrudeGeometry(lug, { depth: 0.8, bevelEnabled: false, curveSegments: 10 }).translate(0, 0, -0.4));
      a.add(b.paint, geo, [sx * (hw - 2), H, sz * (hd - 2)], turn(Y, Math.atan2(-sz, sx)));
    }
  }

  const nozzle = (x: number, z: number, r: number, capped: boolean) => {
    a.cyl(b.paint, r + 1.4, 0.6, Y, [x, H + 0.3, z], 20);
    a.cyl(b.paint, r, 7, Y, [x, H + 3.5, z], 20);
    if (capped) {
      a.cyl(b.paint, r + 0.6, 2.4, Y, [x, H + 7.4, z], 20);
    } else {
      a.torus(b.paint, r - 0.3, 0.35, Y, [x, H + 7, z], 20);
      a.cyl(m.darkSteel, r - 0.5, 0.1, Y, [x, H + 7.05, z], 20); // the open bore
    }
  };
  nozzle(-w * 0.25, -d * 0.1, 3, false);
  nozzle(0, -d * 0.32, 2.6, true);
  nozzle(w * 0.25, -d * 0.05, 2.6, true);

  const base = y0 + 0.8; // the liquid stands on the bottom plate
  const depth = H - base;
  const fill = Math.min(1, Math.max(0, level / 100)) * depth;
  const fm = m.fluid[part.fluid];
  const [lw, ld] = [w - 1.6, d - 1.6];
  if (fill > 0.3) {
    a.box(fm.tankFill, [lw, fill, ld], [0, base + fill / 2, 0]);
    hoop(a, fm.surface, lw - 0.4, ld - 0.4, base + fill, 0.45); // meniscus
  }
  for (const pct of [25, 50, 75]) a.box(m.levelMark, [7, 0.5, 0.5], [0, base + (depth * pct) / 100, hd + 0.4]);
  if (td) {
    hoop(a, m.highMark, w + 0.8, d + 0.8, base + (depth * td.highPct) / 100, 0.6);
    hoop(a, m.highHighMark, w + 0.8, d + 0.8, base + (depth * td.highHighPct) / 100, 0.6);
  }
}

/** A flat plate w × h facing +z. Its uvs count tread tiles, so the pattern is the same size on every plate. */
function plate(w: number, h: number): PlaneGeometry {
  const g = new PlaneGeometry(w, h);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / TREAD_TILE, (uv.getY(i) * h) / TREAD_TILE);
  return g;
}

/** Lathe profile of a flat ring from radius r0 to r1, t thick. Each corner is listed twice so its edges stay sharp. */
function washer(r0: number, r1: number, t: number): [number, number][] {
  const [lo, hi] = [-t / 2, t / 2];
  return [[r1, lo], [r1, hi], [r1, hi], [r0, hi], [r0, hi], [r0, lo], [r0, lo], [r1, lo]];
}

/** A thin rectangular hoop, w × d, at height y: a box tank's counterpart of a ring round a cylinder. */
function hoop(a: Assembly, mat: Material, w: number, d: number, y: number, t: number) {
  for (const s of [-1, 1]) {
    a.box(mat, [w + t, t, t], [0, y, (s * d) / 2]);
    a.box(mat, [t, t, d - t], [(s * w) / 2, y, 0]);
  }
}

/** Pressure gauge on a riser at the end of its line, the dial tipped back towards the default view. */
function gauge(a: Assembly, m: Materials, bar: number, max: number) {
  const r = GAUGE_RADIUS - 1;
  a.cyl(m.steel, 1.5, 14, X, [-7, 0, 0], 10);
  a.sphere(m.steel, 2, [0, 0, 0], undefined, 12);
  a.cyl(m.steel, 1.5, 8, Y, [0, 4, 0], 10);
  a.cyl(m.steel, 2.7, 2.4, Y, [0, 8.6, 0], 6);
  const n = new Vector3(0, Math.sin(0.45), Math.cos(0.45));
  const c = new Vector3(0, 21.5, 0);
  const along = (k: number) => c.clone().addScaledVector(n, k);
  a.cyl(m.darkSteel, r, 5, n, along(-1.6), 40);
  a.torus(m.steel, r - 0.7, 1.2, n, along(0.9), 40);
  a.add(dialMaterial(bar, max), new CircleGeometry(r - 1.6, 48), along(1), toward(Z, n));
  a.add(m.gaugeGlass, new CircleGeometry(r - 1, 48), along(1.9), toward(Z, n));
}

/** The dial face, drawn like the 2D gauge. */
function dialMaterial(bar: number, max: number): MeshStandardMaterial {
  const S = 256;
  const face = GAUGE_RADIUS - 2.6;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const g = canvas.getContext('2d')!;
  g.translate(S / 2, S / 2);
  g.scale(S / 2 / face, S / 2 / face);
  const rad = (deg: number) => ((deg - 90) * Math.PI) / 180;
  const stroke = (color: string, width: number, draw: () => void, alpha = 1) => {
    g.globalAlpha = alpha;
    g.strokeStyle = color;
    g.lineWidth = width;
    g.beginPath();
    draw();
    g.stroke();
    g.globalAlpha = 1;
  };

  g.fillStyle = GAUGE.face;
  g.beginPath();
  g.arc(0, 0, face, 0, Math.PI * 2);
  g.fill();
  stroke(GAUGE.normal, 1.1, () => g.arc(0, 0, 10.2, rad(-135), rad(67)), 0.6);
  stroke(GAUGE.high, 1.4, () => g.arc(0, 0, 10.2, rad(67), rad(135)));
  for (let i = 0; i < 9; i++) {
    const t = rad(-135 + (i * 270) / 8);
    const r1 = i % 2 ? 9.4 : 8.4;
    stroke(GAUGE.ink, i % 2 ? 0.5 : 0.9, () => {
      g.moveTo(Math.cos(t) * r1, Math.sin(t) * r1);
      g.lineTo(Math.cos(t) * 10.6, Math.sin(t) * 10.6);
    });
  }
  g.textAlign = 'center';
  g.fillStyle = GAUGE.unit;
  g.font = '3.4px ui-monospace, Consolas, monospace';
  g.fillText('bar', 0, 6.2);
  g.fillStyle = GAUGE.ink;
  g.font = '700 3.6px system-ui, sans-serif';
  g.fillText('PI', 0, -3.6);
  g.rotate(((-135 + (Math.min(max, Math.max(0, bar)) / max) * 270) * Math.PI) / 180);
  g.fillStyle = GAUGE.needle;
  g.beginPath();
  g.moveTo(-0.95, 1.6);
  g.lineTo(0, -9.4);
  g.lineTo(0.95, 1.6);
  g.fill();
  g.fillStyle = GAUGE.hub;
  g.beginPath();
  g.arc(0, 0, 1.7, 0, Math.PI * 2);
  g.fill();

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return new MeshStandardMaterial({ map: tex, roughness: 0.55 });
}

/** Manifold flange. With a hose connected, the hose runs out and drops to the deck; otherwise a blank flange is fitted. */
function hoseConnection(a: Assembly, m: Materials, d: -1 | 1, connected: boolean) {
  const out = new Vector3(0, 0, d);
  const at = (k: number): V3 => [0, 0, d * k];
  a.cyl(m.steel, 13, 3.6, out, at(0), 40);
  a.bolts(m.steel, 8, 10.6, out, at(2.6), 0.9, 10);
  if (!connected) {
    a.cyl(m.blind, 13, 4.4, out, at(5.2), 40);
    return;
  }
  a.cyl(m.steel, 13, 3.6, out, at(5), 40);
  a.cyl(m.darkSteel, 7, 7, out, at(10.4), 24);
  a.cyl(m.darkSteel, 7.8, 1.8, out, at(13.4), 24);
  const hose = new CatmullRomCurve3([
    new Vector3(0, 0, d * 14),
    new Vector3(0, -1, d * 34),
    new Vector3(-10, -16, d * 60),
    new Vector3(-24, -28.5, d * 84),
    new Vector3(-34, -29.5, d * 130),
  ]);
  a.tube(m.rubber, hose.getPoints(48), 6, 16);
}

/** Non-return (swing check) valve: flanged body, a bolted cover over the disc chamber, hinge-pin bosses and a cast flow arrow. */
function checkValve(a: Assembly, m: Materials, pr: number): V3 {
  const fr = Math.max(pr * 2.1, 7.5);
  for (const s of [-1, 1]) a.flange(m.blue, m.steel, fr, 2.6, X, [s * 13, 0, 0]);
  a.lathe(m.red, [[4.4, -11.7], [4.8, -9], [6.8, -5.5], [7.6, -1.5], [7.6, 2.5], [6.4, 6.5], [4.8, 9], [4.4, 11.7]], X, [0, 0, 0]);
  a.lathe(m.red, [[7.2, 0], [7, 4], [6.8, 7.4]], Y, [-0.5, 0, 0], 28);
  a.cyl(m.blue, 8.4, 1.8, Y, [-0.5, 8.3, 0], 28);
  a.bolts(m.steel, 6, 7.2, Y, [-0.5, 8.6, 0], 0.7, 3.2);
  a.cyl(m.red, 2, 17.5, Z, [-4.5, 4.2, 0], 12);
  // The arrow lies on the cover, pointing the way the flow may go (+x; flip turns it round).
  a.box(m.brass, [6.5, 0.7, 1.5], [-2.4, 9.55, 0]);
  a.add(m.brass, new ConeGeometry(2.6, 4, 4), [2.8, 9.55, 0], toward(Y, X), [0.3, 1, 1]);
  return [5.5, 5.5, 5.2];
}

/**
 * Transfer pump: a horizontal split-case pump, its suction and discharge flanges
 * in line with the pipe, on a baseplate with the motor behind it (north).
 * Returns the position of the running lamp on the motor's terminal box.
 */
function pump(a: Assembly, m: Materials, pr: number): V3 {
  const deck = -PIPE_Y;
  const c = 3; // shaft height, a little above the pipe centre line
  const fr = Math.max(pr * 2.1, 7.5);
  for (const s of [-1, 1]) {
    a.cyl(m.red, pr * 1.25, 10, X, [s * 18, 0, 0], 20);
    a.flange(m.blue, m.steel, fr, 2.6, X, [s * 24, 0, 0]);
  }
  // Volute casing round the shaft, with a split-flange bead and its cover bolts.
  a.lathe(m.red, [[0, -9], [13, -9], [16, -6], [16.5, 0], [16, 6], [13, 9], [0, 9]], Z, [0, c, 0], 40);
  a.torus(m.red, 16.4, 1.1, Z, [0, c, 0], 40);
  for (const s of [-1, 1]) a.bolts(m.steel, 10, 13, Z, [0, c, s * 8.6], 0.8, 1.6);
  // Pedestal and feet down to the baseplate.
  a.box(m.red, [20, 21, 12], [0, -22.5, 0]);
  a.box(m.red, [30, 2, 16], [0, deck + 4, 0]);
  a.box(m.darkSteel, [52, 3, 91], [0, deck + 1.5, -33.5]);
  // Bearing housing, shaft and coupling guard.
  a.cyl(m.red, 5.5, 9, Z, [0, c, -13.5], 24);
  a.cyl(m.steel, 1.8, 8, Z, [0, c, -21], 12);
  a.cyl(m.galvanized, 7.5, 10, Z, [0, c, -26], 24);
  // Motor: ribbed frame, end shields, fan cowl and terminal box, on feet.
  const [mz, mr, ml] = [-50, 12.5, 32];
  a.cyl(m.blue, mr, ml, Z, [0, c, mz], 40);
  a.bolts(m.blue, 18, mr, Z, [0, c, mz], 1.1, ml - 4);
  for (const s of [-1, 1]) a.cyl(m.blue, mr + 0.6, 2, Z, [0, c, mz + (s * ml) / 2], 40);
  a.cyl(m.steel, mr - 0.5, 9, Z, [0, c, mz - ml / 2 - 5.5], 32);
  a.cyl(m.darkSteel, mr - 2, 0.8, Z, [0, c, mz - ml / 2 - 10.2], 32);
  const foot = c - mr;
  for (const z of [mz - 10, mz + 10]) a.box(m.darkSteel, [20, foot - (deck + 3), 6], [0, (foot + deck + 3) / 2, z]);
  const box: V3 = [0, c + mr + 3, mz + 4];
  a.box(m.blue, [9, 6, 11], box);
  return [box[0], box[1] + 3.6, box[2]];
}

/** One side of a duplex filter: a canister standing on legs with its nozzles on the line, a bolted domed cover, vent cock and drain plug. */
function filter(a: Assembly, m: Materials, pr: number) {
  const deck = -PIPE_Y;
  const R = 14;
  const fr = Math.max(pr * 2.1, 7.5);
  for (const s of [-1, 1]) {
    a.cyl(m.red, pr * 1.2, 9, X, [s * (R + 3), 0, 0], 20);
    a.flange(m.blue, m.steel, fr, 2.6, X, [s * (R + 9), 0, 0]);
  }
  const [y0, y1] = [deck + 12, 9]; // the shell, from and to
  a.cyl(m.red, R, y1 - y0, Y, [0, (y0 + y1) / 2, 0], 40);
  a.add(m.red, new SphereGeometry(R, 40, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), [0, y0, 0], undefined, [1, 0.35, 1]);
  a.cyl(m.steel, 1.6, 3, Y, [0, y0 - R * 0.35 - 1, 0], 6);
  // Shell and cover flanges, bolted together, under a domed cover.
  a.cyl(m.blue, R + 3, 2.4, Y, [0, y1 + 1.2, 0], 40);
  a.cyl(m.blue, R + 3, 2.4, Y, [0, y1 + 3.6, 0], 40);
  a.bolts(m.steel, 8, R + 1.6, Y, [0, y1 + 2.4, 0], 0.8, 7);
  a.add(m.blue, new SphereGeometry(R + 0.5, 40, 10, 0, Math.PI * 2, 0, Math.PI / 2), [0, y1 + 4.8, 0], undefined, [1, 0.45, 1]);
  const top = y1 + 4.8 + (R + 0.5) * 0.45;
  a.cyl(m.steel, 1.3, 4, Y, [0, top + 1.5, 0], 10);
  a.box(m.steel, [6, 0.9, 1.2], [1.8, top + 3.2, 0]);
  for (let i = 0; i < 3; i++) {
    const ang = (i / 3) * Math.PI * 2 + Math.PI / 2;
    const [lx, lz] = [Math.cos(ang) * (R - 2), Math.sin(ang) * (R - 2)];
    a.cyl(m.steel, 1.4, 14, Y, [lx, deck + 7, lz], 10);
    a.cyl(m.steel, 2.8, 0.8, Y, [lx, deck + 0.4, lz], 14);
  }
}

/** Drains, blank caps, open ends, small bosses, the D.O / F.O labels at the manifolds and the dashed group boxes. */
export function buildDecorations(def: DiagramDef, m: Materials, anisotropy: number): Group {
  const a = new Assembly();
  const texts: Mesh[] = [];
  for (const d of def.decorations) {
    const [x, y] = d.at;
    const p = new Vector3(x, PIPE_Y, y);
    const end = pipeEndAt(def, d.at);
    const r = end ? pipeRadius(end.pipe) : 5.5;
    switch (d.type) {
      case 'drip': {
        if (!end) break;
        const fm = m.fluid[end.pipe.fluid];
        // The drain turns down at its open end and drips onto a tray on the deck.
        const bend = p.clone().addScaledVector(end.dir, 6);
        const spout = roundCorners([p, bend, bend.clone().setY(PIPE_Y - 12)], r * 1.6);
        a.tube(fm.glassBack, spout, r, 16).tube(fm.glassFront, spout, r, 16).tube(fm.fill, spout, r * BORE, 12);
        const mouth = spout[spout.length - 1];
        a.torus(m.steel, r + 0.3, 0.7, Y, mouth, 20);
        for (const [i, h] of [5, 12, 20].entries()) a.sphere(fm.surface, 1.3 - i * 0.15, [mouth.x, mouth.y - h, mouth.z], [1, 1.5, 1], 12);
        a.box(m.darkSteel, [16, 2.4, 16], [mouth.x, 1.2, mouth.z]);
        a.cyl(fm.liquid, 5, 0.4, Y, [mouth.x, 2.6, mouth.z], 20);
        break;
      }
      case 'cap': {
        const axis = d.orient === 'v' ? X : Z;
        const at = p.clone().addScaledVector(end?.dir ?? axis, 1.5);
        a.cyl(m.blind, r * 1.9, 4, axis, at, 32);
        a.bolts(m.steel, 6, r * 1.45, axis, at, 0.8, 5.6);
        break;
      }
      case 'ring':
        a.torus(m.steel, r + 1.6, 1.8, end?.dir ?? X, p, 32);
        break;
      case 'nub':
        a.cyl(m.steel, 3, 6, X, [x + 10, PIPE_Y, y], 16);
        a.cyl(m.steel, 3.7, 1.4, X, [x + 13.4, PIPE_Y, y], 6);
        break;
      case 'fluidLabel':
        texts.push(flatText(d.text, p, 0, { size: 13, weight: 700, color: UI.ink, spacing: 0.5, anchor: 'start' }, anisotropy));
        break;
      case 'group': {
        // Painted on the deck: a dashed outline, as in 2D.
        const [w, h] = d.size;
        const outline = [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]].map(([px, pz]) => new Vector3(px, 0.15, pz));
        for (const dash of dashes(outline, 8, 6)) {
          for (let i = 1; i < dash.length; i++) {
            const [s, e] = [dash[i - 1], dash[i]];
            const len = s.distanceTo(e);
            const alongX = Math.abs(e.x - s.x) > Math.abs(e.z - s.z);
            if (len > 0.01) a.box(m.deckLine, alongX ? [len, 0.2, 1.2] : [1.2, 0.2, len], s.clone().lerp(e, 0.5));
          }
        }
        break;
      }
    }
  }
  const g = a.build();
  for (const t of texts) g.add(t);
  return g;
}
