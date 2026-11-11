import { Box3, Group, Material, MathUtils, Mesh, MeshStandardMaterial, Texture, Vector3, type Object3D, type PerspectiveCamera } from 'three';
import { UI } from '../components/theme';
import type { Reading } from '../data/readings';
import { GROUP_OF, type SectionData } from '../data/sectionData';
import type { Crossing } from '../diagram/crossings';
import type { DiagramDef, PartDef } from '../diagram/types';
import { PIPE_Y, createMaterials } from './kit';
import { buildDecorations, buildPart } from './parts';
import { buildPipes, pipeRadiusAt } from './pipes';

export interface PartModel {
  /** Holds the part's meshes; stays the same object when the part is rebuilt. */
  group: Group;
  box: Box3;
  center: Vector3;
  size: Vector3;
  corners: Vector3[];
}

export interface SceneModel {
  pipes: Group;
  decorations: Group;
  parts: Map<string, PartModel>;
  bounds: Box3;
  fitPoints: Vector3[];
  glow(tag: string, on: boolean): void;
  /** Rebuilds the parts whose values changed (a valve opened, a level rose). Returns whether any did. */
  update(data: SectionData, readings: Record<string, Reading>): boolean;
  dispose(): void;
}

/** Every material in the shared set, so a rebuilt part disposes only its own. */
function materialsIn(o: unknown, out = new Set<Material>()): Set<Material> {
  if (o instanceof Material) out.add(o);
  else if (o && typeof o === 'object') for (const v of Object.values(o)) materialsIn(v, out);
  return out;
}

/**
 * What a part's model is built from, so it is rebuilt only when that changes. Readings are rounded to
 * steps too small to see (tank levels to half a percent), a tank's level comes from its reading, and a
 * valve's component data doesn't change and isn't drawn.
 */
function partKey(part: PartDef, data: SectionData, readings: Record<string, Reading>): string {
  const r = readings[part.tag];
  const step = part.kind === 'TK' ? 0.5 : 0.1;
  const entry: Record<string, unknown> = { ...data[GROUP_OF[part.kind]][part.tag] };
  delete entry.levelPct;
  delete entry.component;
  return JSON.stringify([r?.status, r?.num === undefined ? null : Math.round(r.num / step), entry]);
}

/** The light (linear luminance) the hover glow adds to a part. */
const HOVER_GLOW = 0.09;

export function corners(b: Box3): Vector3[] {
  const out: Vector3[] = [];
  for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) out.push(new Vector3(x, y, z));
  return out;
}

export function buildModel(def: DiagramDef, crossings: Crossing[], data: SectionData, readings: Record<string, Reading>, anisotropy: number): SceneModel {
  const mats = createMaterials();
  const pipes = buildPipes(def, crossings, mats);
  const decorations = buildDecorations(def, mats, anisotropy);
  const bounds = new Box3().setFromObject(pipes).union(new Box3().setFromObject(decorations));
  const fitPoints = def.pipes.flatMap((p) => p.pts.map(([x, z]) => new Vector3(x, PIPE_Y, z)));
  const pipeR = new Map(def.parts.map((p) => [p.tag, pipeRadiusAt(def, p.at)]));
  const make = (part: PartDef, d: SectionData, r: Record<string, Reading>) =>
    buildPart(part, { mats, data: d, reading: r[part.tag], pipeR: pipeR.get(part.tag)! });
  const parts = new Map<string, PartModel>();
  const builtFrom = new Map<string, string>();
  for (const part of def.parts) {
    const group = new Group().add(make(part, data, readings));
    const box = new Box3().setFromObject(group);
    parts.set(part.tag, { group, box, center: box.getCenter(new Vector3()), size: box.getSize(new Vector3()), corners: corners(box) });
    builtFrom.set(part.tag, partKey(part, data, readings));
    bounds.union(box);
    fitPoints.push(...corners(box));
  }

  const shared = materialsIn(mats);
  const glowing = new Set<string>();
  const glowCache = new Map<Material, Material>();
  const glowMaterial = (base: Material) => {
    let m = glowCache.get(base);
    if (!m) {
      m = base.clone();
      m.onBeforeCompile = base.onBeforeCompile;
      if (m instanceof MeshStandardMaterial) {
        if (m.emissive.getHex() === 0) {
          // A glow can only add light, so the highlight just tints it, scaled to the same strength however dark it is.
          m.emissive.set(UI.highlight);
          const { r, g, b } = m.emissive;
          m.emissiveIntensity = HOVER_GLOW / Math.max(0.2126 * r + 0.7152 * g + 0.0722 * b, 1e-3);
        } else {
          m.emissiveIntensity *= 1.6;
        }
      }
      glowCache.set(base, m);
    }
    return m;
  };

  const glow = (tag: string, on: boolean) => {
    if (on) glowing.add(tag);
    else glowing.delete(tag);
    parts.get(tag)?.group.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      if (on && !o.userData.base) {
        o.userData.base = o.material;
        o.material = glowMaterial(o.material);
      } else if (!on && o.userData.base) {
        o.material = o.userData.base;
        delete o.userData.base;
      }
    });
  };

  /** Frees a replaced part model: its geometry, and any material made just for it (a gauge's dial). */
  const disposePart = (root: Object3D) => {
    root.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      o.geometry.dispose();
      const own = o.userData.base ?? o.material;
      if (shared.has(own)) return;
      for (const value of Object.values(own)) if (value instanceof Texture) value.dispose();
      own.dispose();
      glowCache.get(own)?.dispose();
      glowCache.delete(own);
    });
  };

  const roots = [pipes, decorations, ...[...parts.values()].map((p) => p.group)];
  return {
    pipes,
    decorations,
    parts,
    bounds,
    fitPoints,
    glow,
    update(d, r) {
      let changed = false;
      for (const part of def.parts) {
        const key = partKey(part, d, r);
        if (key === builtFrom.get(part.tag)) continue;
        builtFrom.set(part.tag, key);
        const entry = parts.get(part.tag)!;
        const lit = glowing.has(part.tag);
        if (lit) glow(part.tag, false);
        for (const old of [...entry.group.children]) {
          entry.group.remove(old);
          disposePart(old);
        }
        entry.group.add(make(part, d, r));
        entry.box.setFromObject(entry.group);
        entry.box.getCenter(entry.center);
        entry.box.getSize(entry.size);
        entry.corners.splice(0, entry.corners.length, ...corners(entry.box));
        if (lit) glow(part.tag, true);
        changed = true;
      }
      return changed;
    },
    dispose() {
      const materials = new Set<Material>(glowCache.values());
      for (const root of roots) {
        root.traverse((o) => {
          if (!(o instanceof Mesh)) return;
          o.geometry.dispose();
          for (const m of [o.material, o.userData.base].flat()) if (m) materials.add(m);
        });
      }
      const textures = new Set<Texture>();
      for (const m of materials) {
        for (const value of Object.values(m)) if (value instanceof Texture) textures.add(value);
        m.dispose();
      }
      for (const t of textures) t.dispose();
    },
  };
}


export const TILT_DEGREES = 25;

export const TILT = MathUtils.degToRad(TILT_DEGREES);

export function homeView(camera: PerspectiveCamera, model: SceneModel) {
  const target = model.bounds.getCenter(new Vector3()).setY(0);
  const dir = new Vector3().setFromSphericalCoords(1, TILT, 0);
  const ahead = new Vector3(-dir.x, 0, -dir.z).normalize(); // along the deck, away from the camera
  const cam = camera.clone();
  const halfH = Math.tan(MathUtils.degToRad(cam.fov / 2));
  const place = (d: number) => {
    cam.position.copy(target).addScaledVector(dir, d);
    cam.lookAt(target);
    cam.updateMatrixWorld();
  };
  const extent = () => {
    const e = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, behind: false };
    for (const p of model.fitPoints) {
      const v = p.clone().project(cam);
      e.behind ||= v.z >= 1;
      [e.x0, e.x1, e.y0, e.y1] = [Math.min(e.x0, v.x), Math.max(e.x1, v.x), Math.min(e.y0, v.y), Math.max(e.y1, v.y)];
    }
    return e;
  };
  let d = 0;
  // Find the distance that fits, then slide the target so the content sits in the middle; repeat to settle.
  for (let pass = 0; pass < 3; pass++) {
    let [lo, hi] = [50, 20000];
    for (let i = 0; i < 30; i++) {
      place((lo + hi) / 2);
      const e = extent();
      // Some room left at the sides for the callouts beside the outermost parts.
      if (!e.behind && Math.max(-e.x0, e.x1) < 0.9 && Math.max(-e.y0, e.y1) < 0.9) hi = (lo + hi) / 2;
      else lo = (lo + hi) / 2;
    }
    d = hi;
    place(d);
    const e = extent();
    target.x += ((e.x0 + e.x1) / 2) * d * halfH * cam.aspect;
    target.addScaledVector(ahead, (((e.y0 + e.y1) / 2) * d * halfH) / Math.cos(TILT));
  }
  return { position: target.clone().addScaledVector(dir, d), target };
}
