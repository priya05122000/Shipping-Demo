import { Color, Group, Mesh, ShaderMaterial } from 'three';
import { FLUID_STYLE } from '../components/theme';
import type { Crossing } from '../diagram/crossings';
import type { FlowRun } from '../operations/flow';
import { BORE, ORDER, roundCorners, sweepTube } from './kit';
import { centreLine, pipeRadius } from './pipes';

/** The flowing core's radius, as a fraction of the liquid bore. */
const CORE = 0.6;

/**
 * Inside a flowing pipe: a core of the line's deep colour with lighter bands moving along it the way the
 * fuel goes. Only the part behind the front (uFront, along the run) shows, so the fuel can be seen
 * running in. Unlit, so the sun doesn't change it.
 */
function flowMaterial(run: FlowRun): ShaderMaterial {
  const s = FLUID_STYLE[run.pipe.fluid];
  const m = new ShaderMaterial({
    uniforms: {
      uColor: { value: new Color(s.liquid) },
      uHi: { value: new Color(s.liquidHi) },
      uFront: { value: 0 },
      uPhase: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying float vAlong;
      void main() {
        vAlong = uv.y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform vec3 uHi;
      uniform float uFront;
      uniform float uPhase;
      varying float vAlong;
      void main() {
        if (vAlong > uFront) discard;
        float band = smoothstep(0.55, 1.0, 0.5 + 0.5 * sin((vAlong - uPhase) * 0.3));
        gl_FragColor = vec4(mix(uColor, uHi, band), 0.85);
      }`,
    transparent: true,
    depthWrite: false,
  });
  return m;
}

export interface FlowMeshes {
  group: Group;
  items: { run: FlowRun; material: ShaderMaterial }[];
  dispose(): void;
}

/** One tube per flowing run, along the same rounded centre line as its glass pipe (dips at crossings included). */
export function buildFlowMeshes(runs: FlowRun[], crossings: Crossing[]): FlowMeshes {
  const group = new Group();
  const items = runs.map((run) => {
    const r = pipeRadius(run.pipe);
    const path = roundCorners(centreLine(run.pipe, run.pts, crossings), r * 2.2);
    const material = flowMaterial(run);
    const mesh = new Mesh(sweepTube(path, r * BORE * CORE, 12), material);
    mesh.renderOrder = ORDER.liquid;
    group.add(mesh);
    return { run, material };
  });
  return {
    group,
    items,
    dispose() {
      group.traverse((o) => {
        if (o instanceof Mesh) o.geometry.dispose();
      });
      for (const it of items) it.material.dispose();
    },
  };
}
