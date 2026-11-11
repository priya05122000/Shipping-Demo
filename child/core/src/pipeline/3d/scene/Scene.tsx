import { CameraControls, CameraControlsImpl, Environment, Lightformer } from '@react-three/drei';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { EffectComposer, N8AO, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { memo, useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import {
  Box3,
  Box3Helper,
  DirectionalLight,
  DoubleSide,
  LineBasicMaterial,
  RingGeometry,
  ShadowMaterial,
  Vector2,
  Vector3,
  type Mesh,
  type PerspectiveCamera,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LIGHT, UI } from '../../view/theme';
import type { Reading } from '../../data/readings';
import type { SectionData } from '../../data/sectionData';
import type { Crossing } from '../../model/crossings';
import type { DiagramDef, PartDef, TextLabel } from '../../model/types';
import { FRONT_SPEED, type FlowRun } from '../../simulation/flow';
import { buildFlowMeshes } from './flow';
import { PIPE_Y } from './kit';
import { flatText, type TextStyle } from './labels';
import { TILT, buildModel, corners, homeView, type PartModel, type SceneModel } from './model';
import { beforeNeutral } from './tone';

/** What the page around the canvas can ask of the view. */
export interface ViewApi {
  zoomIn(): void;
  zoomOut(): void;
  fit(): void;
  /** Draw a frame, e.g. after the callouts changed. */
  redraw(): void;
}

/**
 * The callout elements, which are ordinary DOM over the canvas, and their
 * measured sizes. The scene moves each one next to its part every frame.
 */
export interface CalloutRegistry {
  els: Map<string, HTMLDivElement>;
  sizes: Map<string, [number, number]>;
}

interface Props {
  def: DiagramDef;
  crossings: Crossing[];
  data: SectionData;
  readings: Record<string, Reading>;
  /** Pipes with flow in them. */
  runs: FlowRun[];
  showTags: boolean;
  selected: string | null;
  hoverTag: string | null;
  onSelect: (tag: string | null) => void;
  /** The pointer is over a part (x, y its client coordinates, in pixels on the page), or over none. */
  onHover: (hover: { tag: string; x: number; y: number } | null) => void;
  callouts: RefObject<CalloutRegistry>;
  api: RefObject<ViewApi | null>;
}

const { ACTION } = CameraControlsImpl;
/** The 2D drawing's grid: one line every 40 units. */
const GRID = { step: 40, width: 0.3, color: UI.grid };
/** Zoom steps of the + and − buttons, as in 2D. */
const ZOOM_STEP = 1.3;
/** Closest the camera may come to the point it looks at: well clear of the tallest tank. */
const MIN_DISTANCE = 200;
/** Unlit, so it is drawn before the tone curve to land on the highlight colour exactly. */
const SELECT_COLOR = beforeNeutral(UI.highlight);
/** Pointer travel (px) above which a press is a drag, not a click. */
const DRAG_THRESHOLD = 4;
/** Extra room around each part's box that still counts as pointing at it, like the 2D hit areas. */
const HIT_PAD = 3;
/**
 * Callouts are sized in diagram units like the 2D ones, so they grow and shrink
 * with the view. Below MIN_SCALE they are too small to read and are hidden.
 */
const MIN_SCALE = 0.3;
const MAX_SCALE = 1.6;
/** How fast the lighter bands move along a flowing pipe, units per second. */
const BAND_SPEED = 30;
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The 3D view of a section: glass pipes and 3D parts on a deck. Render inside a <Canvas>. */
export const PipelineScene = memo(function PipelineScene({
  def,
  crossings,
  data,
  readings,
  runs,
  showTags,
  selected,
  hoverTag,
  onSelect,
  onHover,
  callouts,
  api,
}: Props) {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  // Built once with the values at the time; after that only the parts whose values change are rebuilt (below).
  const first = useRef({ data, readings });
  const model = useMemo(
    () => buildModel(def, crossings, first.current.data, first.current.readings, gl.capabilities.getMaxAnisotropy()),
    [def, crossings, gl],
  );
  useEffect(() => () => model.dispose(), [model]);

  useEffect(() => {
    if (!model.update(data, readings)) return;
    // The shadows are drawn only when something changes.
    gl.shadowMap.needsUpdate = true;
    invalidate();
  }, [model, data, readings, gl, invalidate]);

  useEffect(() => {
    if (!hoverTag) return;
    model.glow(hoverTag, true);
    gl.domElement.style.cursor = 'pointer';
    invalidate();
    return () => {
      model.glow(hoverTag, false);
      gl.domElement.style.cursor = '';
      invalidate();
    };
  }, [model, hoverTag, gl, invalidate]);

  const pick = (tag: string) => onSelect(tag === selected ? null : tag);
  const bg = useMemo(() => beforeNeutral(UI.page), []);

  return (
    <>
      <color attach="background" args={[bg.r, bg.g, bg.b]} />
      <Lighting bounds={model.bounds} />
      <Floor def={def} />
      <primitive object={model.pipes} />
      <FlowLayer runs={runs} crossings={crossings} />
      <primitive object={model.decorations} />
      {def.parts.map((part) => (
        <Part key={part.tag} tag={part.tag} entry={model.parts.get(part.tag)!} onHover={onHover} onPick={pick} />
      ))}
      {def.labels.map((l, i) => (
        <Label key={i} label={l} visible={l.kind !== 'line' || showTags} />
      ))}
      <Selection entry={selected ? model.parts.get(selected) : undefined} />
      <CalloutLayout parts={def.parts} model={model} callouts={callouts} />
      <Controls model={model} api={api} />
      {/* Ambient occlusion darkens creases and contact points; then a neutral filmic tone curve. Full resolution:
          n8ao's halfRes uses a multiple-render-target shim (n8ao 2.0.1) that three.js r187 can't set up. */}
      <EffectComposer multisampling={4}>
        <N8AO aoRadius={14} distanceFalloff={1} intensity={2.4} quality="medium" />
        <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      </EffectComposer>
    </>
  );
});

function Lighting({ bounds }: { bounds: Box3 }) {
  return (
    <>
      {/* The sun does most of the lighting so its shadows read; sky and studio panels fill in. */}
      <hemisphereLight args={[LIGHT.sky, UI.page, 0.35]} />
      <Sun bounds={bounds} />
      {/* A small studio of light panels for the reflections on glass and metal; nothing is downloaded. */}
      <Environment resolution={256} environmentIntensity={0.4}>
        <Lightformer form="rect" intensity={3} position={[0, 8, 0]} scale={[14, 14, 1]} />
        <Lightformer form="rect" intensity={1.2} position={[-9, 2, 0]} scale={[20, 3, 1]} />
        <Lightformer form="rect" intensity={1.2} position={[9, 2, 0]} scale={[20, 3, 1]} />
        <Lightformer form="rect" intensity={0.8} position={[0, 2, 9]} scale={[20, 3, 1]} />
      </Environment>
    </>
  );
}

/**
 * The key light, from the north-west (the top left of the screen) and high up,
 * so shadows fall down and to the right like the 2D drop shadows. Nothing
 * moves, so the shadows are drawn once.
 */
function Sun({ bounds }: { bounds: Box3 }) {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const sun = useMemo(() => {
    const c = bounds.getCenter(new Vector3());
    const light = new DirectionalLight(LIGHT.sun, 4.2);
    light.position.set(c.x - 600, 1500, c.z - 750);
    light.target.position.set(c.x, 0, c.z);
    light.castShadow = true;
    light.shadow.mapSize.set(4096, 4096);
    light.shadow.bias = -0.0002;
    light.shadow.normalBias = 0.5;
    light.shadow.radius = 3;
    // Fit the shadow camera tightly around the content, seen from the light.
    const cam = light.shadow.camera;
    cam.position.copy(light.position);
    cam.lookAt(light.target.position);
    cam.updateMatrixWorld();
    const reach = bounds.clone().expandByScalar(60);
    reach.min.y = -10;
    const lb = new Box3().setFromPoints(corners(reach).map((p) => p.applyMatrix4(cam.matrixWorldInverse)));
    cam.left = lb.min.x;
    cam.right = lb.max.x;
    cam.bottom = lb.min.y;
    cam.top = lb.max.y;
    cam.near = Math.max(1, -lb.max.z - 50);
    cam.far = -lb.min.z + 50;
    cam.updateProjectionMatrix();
    return light;
  }, [bounds]);

  useEffect(() => {
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
    invalidate();
    return () => sun.dispose();
  }, [gl, sun, invalidate]);

  return (
    <>
      <primitive object={sun} />
      <primitive object={sun.target} />
    </>
  );
}

/**
 * The floor, drawn like the 2D background: the page colour, with the
 * drawing's grid over the diagram's area. Shadows tint it so the bare floor
 * in full shadow shows LIGHT.shadow and the grid stays visible through it.
 */
function floorMaterial(def: DiagramDef) {
  const m = new ShadowMaterial({ transparent: false });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      bg: { value: beforeNeutral(UI.page) },
      line: { value: beforeNeutral(GRID.color) },
      area: { value: new Vector2(def.width, def.height) },
      gridStep: { value: GRID.step },
      halfWidth: { value: GRID.width / 2 },
      shadow: { value: beforeNeutral(LIGHT.shadow) },
    });
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'varying vec2 vDeck;\nvoid main() {')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDeck = (modelMatrix * vec4(transformed, 1.0)).xz;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'void main() {',
        'uniform vec3 bg, line, shadow;\nuniform vec2 area;\nuniform float gridStep, halfWidth;\nvarying vec2 vDeck;\nvoid main() {',
      )
      .replace(
        'gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );',
        `// Distance to the nearest grid line (lines start at multiples of the step, like
        // the 2D pattern), and how much of this pixel the line covers.
        vec2 f = fwidth(vDeck);
        vec2 g = abs(mod(vDeck - halfWidth + 0.5 * gridStep, gridStep) - 0.5 * gridStep);
        vec2 cover = max(min(g + 0.5 * f, vec2(halfWidth)) - max(g - 0.5 * f, vec2(-halfWidth)), 0.0) / f;
        bool inside = all(greaterThanEqual(vDeck, vec2(0.0))) && all(lessThanEqual(vDeck, area));
        vec3 c = mix(bg, line, inside ? max(cover.x, cover.y) : 0.0);
        gl_FragColor = vec4(c * mix(vec3(1.0), shadow / bg, 1.0 - getShadowMask()), 1.0);`,
      );
  };
  return m;
}

/** The floor under the diagram, reaching well past it so its edge never shows. */
function Floor({ def }: { def: DiagramDef }) {
  const material = useMemo(() => floorMaterial(def), [def]);
  useEffect(() => () => material.dispose(), [material]);
  return (
    <mesh position={[def.width / 2, 0, def.height / 2]} rotation-x={-Math.PI / 2} material={material} receiveShadow>
      <planeGeometry args={[def.width * 5, def.height * 5]} />
    </mesh>
  );
}

/** A part's model, with an invisible padded box that takes the pointer events. */
function Part({ tag, entry, onHover, onPick }: { tag: string; entry: PartModel; onHover: Props['onHover']; onPick: (tag: string) => void }) {
  const hover = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    // While the camera is being dragged, the pointer passing over parts doesn't count.
    onHover(e.nativeEvent.buttons ? null : { tag, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY });
  };
  return (
    <>
      <primitive object={entry.group} />
      <mesh
        visible={false}
        position={entry.center}
        onPointerMove={hover}
        onPointerOut={() => onHover(null)}
        onClick={(e) => {
          e.stopPropagation();
          if (e.delta <= DRAG_THRESHOLD) onPick(tag);
        }}
      >
        <boxGeometry args={[entry.size.x + HIT_PAD * 2, entry.size.y + HIT_PAD * 2, entry.size.z + HIT_PAD * 2]} />
      </mesh>
    </>
  );
}

const LABEL_STYLE: Record<TextLabel['kind'], TextStyle> = {
  area: { size: 22, color: UI.ink, spacing: 5 },
  line: { size: 9.5, color: UI.ink, mono: true, spacing: 0.5 },
  note: { size: 11, color: UI.ink, weight: 600, spacing: 0.4 },
};

/** Area names and captions painted on the deck; line numbers lying beside their pipes (shown with Tags). */
function Label({ label, visible }: { label: TextLabel; visible: boolean }) {
  const anisotropy = useThree((s) => s.gl.capabilities.getMaxAnisotropy());
  const mesh = useMemo(() => {
    const at = new Vector3(label.at[0], label.kind === 'line' ? PIPE_Y : 0.2, label.at[1]);
    return flatText(label.text, at, label.rot ?? 0, LABEL_STYLE[label.kind], anisotropy);
  }, [label, anisotropy]);
  useEffect(
    () => () => {
      mesh.geometry.dispose();
      mesh.material.map?.dispose();
      mesh.material.dispose();
    },
    [mesh],
  );
  return <primitive object={mesh} visible={visible} />;
}

/** The tubes are rebuilt only when the flowing pipes change, not as the rate changes. */
const runsKey = (runs: FlowRun[]) => runs.map((r) => `${r.id}>${r.pts.length}`).join('|');

/**
 * The fuel running into the flowing pipes, as in 2D: each run fills from where the flow enters it
 * when the front gets there, then lighter bands move along it.
 */
function FlowLayer({ runs, crossings }: { runs: FlowRun[]; crossings: Crossing[] }) {
  const key = runsKey(runs);
  const latest = useRef(runs);
  latest.current = runs;
  const flow = useMemo(() => buildFlowMeshes(latest.current, crossings), [key, crossings]);
  useEffect(() => () => flow.dispose(), [flow]);
  // When the flow started, and when each run first appeared.
  const started = useRef<number | null>(null);
  const appeared = useRef(new Map<string, number>());
  const animate = useMemo(() => !reducedMotion(), []);

  useFrame((state) => {
    if (!flow.items.length) {
      started.current = null;
      appeared.current.clear();
      return;
    }
    const now = performance.now() / 1000;
    started.current ??= now;
    for (const { run, material } of flow.items) {
      if (!appeared.current.has(run.id)) appeared.current.set(run.id, now);
      const from = Math.max(appeared.current.get(run.id)!, started.current + run.start / FRONT_SPEED);
      material.uniforms.uFront.value = animate ? (now - from) * FRONT_SPEED : 1e9;
      material.uniforms.uPhase.value = animate ? now * BAND_SPEED : 0;
    }
    state.invalidate();
  });

  return <primitive object={flow.group} />;
}

/** A dashed ring lying flat, radius 1. */
function dashedRing() {
  const n = 18;
  const arcs = Array.from({ length: n }, (_, i) => new RingGeometry(0.9, 1, 6, 1, (i / n) * Math.PI * 2, (Math.PI * 2) / n / 1.7));
  const geo = mergeGeometries(arcs)!;
  for (const a of arcs) a.dispose();
  return geo.rotateX(-Math.PI / 2);
}

/** The selected part: a pulsing box around it and a turning dashed ring on the deck. */
function Selection({ entry }: { entry?: PartModel }) {
  const ringRef = useRef<Mesh>(null);
  const ring = useMemo(dashedRing, []);
  const helper = useMemo(() => {
    const h = new Box3Helper(new Box3(), SELECT_COLOR);
    const m = h.material as LineBasicMaterial;
    m.transparent = true;
    m.depthTest = false;
    h.renderOrder = 10;
    return h;
  }, []);
  useEffect(
    () => () => {
      ring.dispose();
      helper.dispose();
    },
    [ring, helper],
  );
  useLayoutEffect(() => {
    if (entry) helper.box.copy(entry.box).expandByScalar(4);
  }, [entry, helper]);
  const animate = useMemo(() => !reducedMotion(), []);

  useFrame((state) => {
    if (!entry || !animate) return;
    const t = state.clock.elapsedTime;
    ringRef.current!.rotation.y = t * 0.5;
    (helper.material as LineBasicMaterial).opacity = 0.7 + 0.3 * Math.sin(t * 5);
    state.invalidate();
  });

  if (!entry) return null;
  return (
    <>
      <primitive object={helper} />
      <mesh ref={ringRef} geometry={ring} position={[entry.center.x, 0.5, entry.center.z]} scale={Math.max(entry.size.x, entry.size.z) / 2 + 8} renderOrder={10}>
        <meshBasicMaterial color={SELECT_COLOR} transparent opacity={0.8} depthWrite={false} side={DoubleSide} />
      </mesh>
    </>
  );
}

/**
 * Moves each callout (values and tags, HTML over the canvas) beside its part's
 * on-screen box, on the side diagram.ts asks for, and scales it with the view
 * like the 2D callouts. Callouts are placed from the canvas's centre, where
 * their layer is pinned, so they stay on their parts while the canvas is
 * being resized.
 */
function CalloutLayout({ parts, model, callouts }: { parts: PartDef[]; model: SceneModel; callouts: RefObject<CalloutRegistry> }) {
  useFrame(({ camera, size }) => {
    const { els, sizes } = callouts.current;
    // Measure first and write afterwards, so the browser lays out once.
    for (const [tag, el] of els) if (!sizes.has(tag)) sizes.set(tag, [el.offsetWidth, el.offsetHeight]);
    const v = new Vector3();
    const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const toScreen = (p: Vector3) => {
      v.copy(p).project(camera);
      return [((v.x + 1) / 2) * size.width, ((1 - v.y) / 2) * size.height];
    };
    for (const part of parts) {
      const el = els.get(part.tag);
      const dims = sizes.get(part.tag);
      const entry = model.parts.get(part.tag);
      if (!el || !dims || !entry) continue;
      const [cx, cy] = toScreen(entry.center);
      const [rx, ry] = toScreen(v.copy(entry.center).addScaledVector(right, 10));
      const k = Math.hypot(rx - cx, ry - cy) / 10; // pixels per diagram unit at the part
      const behind = entry.corners.some((c) => v.copy(c).applyMatrix4(camera.matrixWorldInverse).z > -(camera as PerspectiveCamera).near);
      let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
      for (const c of entry.corners) {
        const [x, y] = toScreen(c);
        [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
      }
      if (behind || k < MIN_SCALE || x1 < 0 || y1 < 0 || x0 > size.width || y0 > size.height) {
        el.style.visibility = 'hidden';
        continue;
      }
      const s = Math.min(k, MAX_SCALE);
      const [w, h] = [dims[0] * s, dims[1] * s];
      const [mx, my] = [(x0 + x1) / 2, (y0 + y1) / 2];
      const [x, y] = {
        top: [mx - w / 2, y0 - 5 * s - h],
        bottom: [mx - w / 2, y1 + 5 * s],
        left: [x0 - 7 * s - w, my - h / 2],
        right: [x1 + 7 * s, my - h / 2],
      }[part.label];
      el.style.visibility = 'visible';
      el.style.transform = `translate(${x - size.width / 2}px, ${y - size.height / 2}px) scale(${s})`;
    }
  });
  return null;
}

/**
 * The camera looks down at a fixed angle with the top of the drawing up, like
 * the 2D view, and never turns. Drag pans across the deck, the wheel zooms
 * towards the cursor; on touch, one finger pans and two pinch-zoom.
 */
function Controls({ model, api }: { model: SceneModel; api: RefObject<ViewApi | null> }) {
  const ref = useRef<CameraControlsImpl>(null);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    const controls = ref.current!;
    const smooth = !reducedMotion();
    const home = () => homeView(camera, model);
    const start = home();
    // Zoom range as in 2D: from a tenth of the whole drawing to 1.6 times it.
    const fitDistance = start.position.distanceTo(start.target);
    controls.minDistance = Math.max(fitDistance / 10, MIN_DISTANCE);
    controls.maxDistance = fitDistance * 1.6;
    // The point looked at stays on the deck (zooming to the cursor would lift it off), within a drawing's width of the content.
    const reach = model.bounds.clone().expandByVector(model.bounds.getSize(new Vector3()));
    reach.min.y = reach.max.y = 0;
    controls.setBoundary(reach);
    void controls.setLookAt(...start.position.toArray(), ...start.target.toArray(), false);
    api.current = {
      zoomIn: () => void controls.dollyTo(controls.distance / ZOOM_STEP, smooth),
      zoomOut: () => void controls.dollyTo(controls.distance * ZOOM_STEP, smooth),
      fit: () => {
        const h = home();
        void controls.setLookAt(...h.position.toArray(), ...h.target.toArray(), smooth);
      },
      redraw: () => invalidate(),
    };
    return () => {
      api.current = null;
    };
  }, [camera, model, api, invalidate]);

  return (
    <CameraControls
      ref={ref}
      makeDefault
      mouseButtons={{ left: ACTION.SCREEN_PAN, middle: ACTION.DOLLY, right: ACTION.SCREEN_PAN, wheel: ACTION.DOLLY }}
      touches={{ one: ACTION.TOUCH_SCREEN_PAN, two: ACTION.TOUCH_DOLLY_TRUCK, three: ACTION.TOUCH_SCREEN_PAN }}
      dollyToCursor
      minPolarAngle={TILT}
      maxPolarAngle={TILT}
      minAzimuthAngle={0}
      maxAzimuthAngle={0}
      smoothTime={0.25}
      draggingSmoothTime={0.08}
    />
  );
}
