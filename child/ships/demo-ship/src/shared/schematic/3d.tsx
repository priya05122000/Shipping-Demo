import { useEffect, useMemo, useState } from "react";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import { Quaternion, Vector3 } from "three";
import { ObjectModel3D } from "@shipdocs/viewer-core/objects/model3d";
import { indexSchematic, pipeRoute, pipeWeight } from "./geometry";
import { KIND_LABELS, SchematicPanels } from "./panel";
import { useSchematicSelection } from "./selection";
import { selectionKey, type Crossing, type Equipment, type Point, type Schematic } from "./types";

/*
 * 3D (react-three-fiber) entry point of this ship's schematics. The schematic's drawing coordinates are laid on a
 * vertical plane (x → X, y → −Y), so the 3D view keeps the drawing's layout; sizes are visual, not engineering ones.
 */

/** Scene units per drawing pixel. */
export const SCALE = 0.01;

type Vec3 = [number, number, number];

function useWorld(schematic: Schematic) {
  return useMemo(() => {
    const cx = schematic.width / 2;
    const cy = (100 + schematic.height) / 2;
    return (p: Point, z = 0): Vec3 => [(p[0] - cx) * SCALE, -(p[1] - cy) * SCALE, z];
  }, [schematic]);
}

/**
 * The viewer's accent colour (var(--color-accent-600), the ship's theme if it sets one) as an sRGB hex for three.js,
 * read once from the page; it may be written in oklch or color-mix, which three.js can't parse.
 */
export function useAccentColor(fallback = "#4f46e5"): string {
  const [color, setColor] = useState(fallback);
  useEffect(() => {
    const probe = document.createElement("span");
    probe.style.color = "var(--color-accent-600)";
    probe.style.display = "none";
    document.body.appendChild(probe);
    const computed = getComputedStyle(probe).color;
    probe.remove();
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context || !computed) return;
    context.fillStyle = computed;
    context.fillRect(0, 0, 1, 1);
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
    setColor(`#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`);
  }, []);
  return color;
}

// ---------------------------------------------------------------------------------------------------------------
// Pipes
// ---------------------------------------------------------------------------------------------------------------

const UP = new Vector3(0, 1, 0);

function Segment({ a, b, radius, color, opacity }: { a: Vec3; b: Vec3; radius: number; color: string; opacity: number }) {
  const { position, quaternion, length } = useMemo(() => {
    const start = new Vector3(...a);
    const end = new Vector3(...b);
    const direction = end.clone().sub(start);
    const length = direction.length();
    const quaternion = new Quaternion().setFromUnitVectors(UP, direction.clone().normalize());
    return { position: start.add(end).multiplyScalar(0.5), quaternion, length };
  }, [a, b]);
  if (length === 0) return null;
  return (
    <mesh position={position} quaternion={quaternion}>
      <cylinderGeometry args={[radius, radius, length, 12]} />
      <meshStandardMaterial color={color} roughness={0.45} metalness={0.25} transparent={opacity < 1} opacity={opacity} />
    </mesh>
  );
}

const HOP = 8;
const LIFT = 0.12;

/** The pipe's route in drawing pixels with z offsets, bridging in front of every pipe it crosses. */
function routeWithBridges(points: Point[], crossings: Crossing[] = []): { p: Point; z: number }[] {
  const out: { p: Point; z: number }[] = [];
  points.forEach((point, i) => {
    if (i > 0) {
      const [ax, ay] = points[i - 1];
      const [bx, by] = point;
      const length = Math.hypot(bx - ax, by - ay);
      if (length > 0) {
        const ux = (bx - ax) / length;
        const uy = (by - ay) / length;
        const along = crossings
          .map((crossing) => ({ off: Math.abs((crossing.at[0] - ax) * uy - (crossing.at[1] - ay) * ux), t: (crossing.at[0] - ax) * ux + (crossing.at[1] - ay) * uy }))
          .filter(({ off, t }) => off < 2 && t > HOP && t < length - HOP)
          .map(({ t }) => t)
          .sort((p, q) => p - q);
        for (const t of along) {
          const at = (d: number): Point => [ax + ux * (t + d), ay + uy * (t + d)];
          out.push({ p: at(-HOP), z: 0 }, { p: at(-HOP / 2), z: LIFT }, { p: at(HOP / 2), z: LIFT }, { p: at(HOP), z: 0 });
        }
      }
    }
    out.push({ p: point, z: 0 });
  });
  return out;
}

export interface Pipe3DProps {
  points: Vec3[];
  radius: number;
  color: string;
  opacity?: number;
}

/** A pipe through `points`: straight runs with a ball at every bend, so bends and tees read as joints. */
export function Pipe3D({ points, radius, color, opacity = 1 }: Pipe3DProps) {
  return (
    <group>
      {points.slice(1).map((point, i) => (
        <Segment key={i} a={points[i]} b={point} radius={radius} color={color} opacity={opacity} />
      ))}
      {points.slice(1, -1).map((point, i) => (
        <mesh key={`j${i}`} position={point}>
          <sphereGeometry args={[radius * 1.15, 12, 8]} />
          <meshStandardMaterial color={color} roughness={0.45} metalness={0.25} transparent={opacity < 1} opacity={opacity} />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Equipment, modelled along local +X (inlet −X, outlet +X) with "up" as +Y; the item's group rotates it
// ---------------------------------------------------------------------------------------------------------------

const STEEL = "#94a3b8";
const DARK = "#334155";

function Cone({ x, y = 0, pointing, radius, height }: { x: number; y?: number; pointing: "+x" | "-x" | "-y"; radius: number; height: number }) {
  const rotation: Vec3 = pointing === "+x" ? [0, 0, -Math.PI / 2] : pointing === "-x" ? [0, 0, Math.PI / 2] : [Math.PI, 0, 0];
  return (
    <mesh position={[x, y, 0]} rotation={rotation}>
      <coneGeometry args={[radius, height, 20]} />
      <meshStandardMaterial color={STEEL} roughness={0.35} metalness={0.6} />
    </mesh>
  );
}

/** A shared 3D shape for equipment without a Library object. */
export function EquipmentModel3D({ item, color }: { item: Equipment; color: string }) {
  const s = item.size * SCALE;
  const h = s / 2;
  switch (item.kind) {
    case "tank":
      return (
        <mesh>
          <boxGeometry args={[s, s, s]} />
          <meshStandardMaterial color={color} transparent opacity={0.55} roughness={0.6} />
        </mesh>
      );
    case "valve":
    case "relief-valve":
      return (
        <group>
          <Cone x={-h / 2} pointing="+x" radius={h * 0.6} height={h} />
          <Cone x={h / 2} pointing="-x" radius={h * 0.6} height={h} />
          {(item.variant === "handwheel" || item.kind === "relief-valve") && (
            <mesh position={[0, h * 0.5, 0]}>
              <cylinderGeometry args={[h * 0.08, h * 0.08, h, 8]} />
              <meshStandardMaterial color={DARK} />
            </mesh>
          )}
          {item.variant === "handwheel" && (
            <mesh position={[0, h, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[h * 0.45, h * 0.07, 8, 24]} />
              <meshStandardMaterial color="#2563eb" />
            </mesh>
          )}
          {item.kind === "relief-valve" && (
            <mesh position={[0, h * 1.1, 0]}>
              <cylinderGeometry args={[h * 0.25, h * 0.25, h * 0.5, 12]} />
              <meshStandardMaterial color={DARK} wireframe />
            </mesh>
          )}
          {item.variant === "globe" && (
            <mesh>
              <sphereGeometry args={[h * 0.35, 16, 12]} />
              <meshStandardMaterial color={DARK} />
            </mesh>
          )}
          {item.variant === "blind" && (
            <mesh position={[h * 1.15, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[h * 0.7, h * 0.7, h * 0.25, 20]} />
              <meshStandardMaterial color={DARK} />
            </mesh>
          )}
        </group>
      );
    case "angle-valve":
      return (
        <group>
          <Cone x={-h / 2} pointing="+x" radius={h * 0.6} height={h} />
          <Cone x={0} y={h / 2} pointing="-y" radius={h * 0.6} height={h} />
          <mesh position={[0, -h * 0.45, 0]}>
            <cylinderGeometry args={[h * 0.2, h * 0.2, h * 0.7, 12]} />
            <meshStandardMaterial color={DARK} wireframe />
          </mesh>
        </group>
      );
    case "gauge":
      return (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[h, h, h * 0.5, 24]} />
          <meshStandardMaterial color="white" roughness={0.3} />
        </mesh>
      );
    case "spool":
      return (
        <group rotation={[0, 0, Math.PI / 2]}>
          <mesh>
            <cylinderGeometry args={[h * 0.3, h * 0.3, s, 16]} />
            <meshStandardMaterial color={STEEL} metalness={0.6} roughness={0.35} />
          </mesh>
          {[-h, h].map((y) => (
            <mesh key={y} position={[0, y, 0]}>
              <cylinderGeometry args={[h * 0.6, h * 0.6, h * 0.15, 20]} />
              <meshStandardMaterial color="#2563eb" />
            </mesh>
          ))}
        </group>
      );
    case "end-flange":
      return (
        <group>
          {[s * 0.1, -s * 0.1].map((y) => (
            <mesh key={y} position={[0, y, 0]}>
              <cylinderGeometry args={[h * 0.8, h * 0.8, s * 0.07, 24]} />
              <meshStandardMaterial color={DARK} metalness={0.5} />
            </mesh>
          ))}
        </group>
      );
    case "open-end":
      return item.variant === "circle" ? (
        <mesh>
          <torusGeometry args={[h * 0.8, h * 0.18, 8, 20]} />
          <meshStandardMaterial color={DARK} />
        </mesh>
      ) : (
        <mesh position={[0, -h * 0.1, 0]}>
          <coneGeometry args={[h * 0.7, h, 16, 1, true]} />
          <meshStandardMaterial color={DARK} side={2} />
        </mesh>
      );
  }
}

interface Item3DProps {
  item: Equipment;
  position: Vec3;
  color: string;
  accent: string;
  selected: boolean;
  connected: boolean;
  dimmed: boolean;
  showLabel: boolean;
  onActivate: (key: string) => void;
}

function Item3D({ item, position, color, accent, selected, connected, dimmed, showLabel, onActivate }: Item3DProps) {
  const [hovered, setHovered] = useState(false);
  const s = item.size * SCALE;
  const angle = (-item.rotation * Math.PI) / 180;
  const handlers = {
    onClick: (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation();
      onActivate(selectionKey(item));
    },
    onPointerOver: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      setHovered(true);
    },
    onPointerOut: () => setHovered(false),
  };
  useEffect(() => {
    if (!hovered) return;
    document.body.style.cursor = "pointer";
    return () => {
      document.body.style.cursor = "";
    };
  }, [hovered]);
  return (
    <group position={position} {...handlers}>
      {item.object ? (
        <ObjectModel3D id={item.object} size={Math.max(s * 3, 0.3)} selected={selected} />
      ) : (
        <group rotation={[0, 0, angle]}>
          <EquipmentModel3D item={item} color={color} />
        </group>
      )}
      {(!item.object && selected) || connected || hovered ? (
        <mesh>
          <boxGeometry args={[s * 1.5, s * 1.5, s * 1.5]} />
          <meshBasicMaterial color={accent} wireframe transparent opacity={selected ? 1 : 0.5} />
        </mesh>
      ) : null}
      {(showLabel || selected || hovered) && item.tag && (
        <Html position={[0, -(s * 0.8 + 0.06), 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
          <span
            className="rounded px-1 text-[10px] leading-none font-medium whitespace-nowrap"
            style={{ color: selected ? accent : "#0f172a", background: "rgba(255,255,255,0.75)", opacity: dimmed ? 0.4 : 1 }}
          >
            {item.tag}
          </span>
        </Html>
      )}
    </group>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// The whole view
// ---------------------------------------------------------------------------------------------------------------

export interface SchematicView3DProps {
  schematic: Schematic;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  hasData?: boolean;
}

/**
 * An interactive 3D schematic filling its parent: orbit, pan and zoom with the mouse; click an item to select it, or
 * empty space to clear. Same geometry, identities and highlighting as the 2D view.
 */
export function SchematicView3D({ schematic, selectedId, onSelect, hasData = false }: SchematicView3DProps) {
  const index = useMemo(() => indexSchematic(schematic), [schematic]);
  const { selected, pipes: litPipes, items: litItems } = useSchematicSelection(index, selectedId);
  const world = useWorld(schematic);
  const accent = useAccentColor();
  const [labels, setLabels] = useState(true);
  const pipes = useMemo(
    () =>
      schematic.pipes.map((pipe) => ({
        pipe,
        points: routeWithBridges(pipeRoute(index, pipe), pipe.crossings).map(({ p, z }) => world(p, z)),
      })),
    [index, schematic, world],
  );
  const anySelected = selected !== null;

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-50">
      <Canvas camera={{ position: [0, -2.5, 12], fov: 45 }} onPointerMissed={() => onSelect(null)}>
        <color attach="background" args={["#f8fafc"]} />
        <ambientLight intensity={0.7} />
        <hemisphereLight args={["#ffffff", "#cbd5e1", 0.6]} />
        <directionalLight position={[6, 8, 10]} intensity={1.1} />
        <mesh position={[0, 0, -0.25]}>
          <planeGeometry args={[schematic.width * SCALE + 0.6, (schematic.height - 100) * SCALE + 0.6]} />
          <meshStandardMaterial color="#ffffff" roughness={1} />
        </mesh>
        {pipes.map(({ pipe, points }) => {
          const lit = litPipes.has(pipe.id);
          return (
            <Pipe3D
              key={pipe.id}
              points={points}
              radius={0.022 * pipeWeight(pipe.bore)}
              color={lit ? accent : (schematic.fluids[pipe.fluid]?.color ?? DARK)}
              opacity={anySelected && !lit ? 0.3 : 1}
            />
          );
        })}
        {schematic.junctions
          .filter((junction) => junction.dot)
          .map((junction) => (
            <mesh key={junction.id} position={world(junction.at)}>
              <sphereGeometry args={[0.045, 16, 12]} />
              <meshStandardMaterial color={DARK} />
            </mesh>
          ))}
        {schematic.equipment.map((item) => (
          <Item3D
            key={item.id}
            item={item}
            position={world(item.at)}
            color={schematic.fluids[item.fluid]?.color ?? DARK}
            accent={accent}
            selected={selected?.id === item.id}
            connected={litItems.has(item.id)}
            dimmed={anySelected && selected?.id !== item.id && !litItems.has(item.id)}
            showLabel={labels}
            onActivate={onSelect}
          />
        ))}
        {schematic.labels
          .filter((label) => label.size)
          .map((label, i) => (
            <Html key={i} position={world(label.at, -0.2)} center zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
              <span className="text-xs font-medium tracking-wide whitespace-nowrap text-slate-500">{label.text}</span>
            </Html>
          ))}
        <OrbitControls makeDefault enableDamping target={[0, 0, 0]} maxDistance={30} minDistance={1.5} />
      </Canvas>

      <button
        type="button"
        onClick={() => setLabels((on) => !on)}
        aria-pressed={labels}
        className="absolute right-2 bottom-2 z-10 rounded-md bg-white/90 px-2 py-1 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-accent-50 focus-visible:outline-2 focus-visible:outline-accent-600"
      >
        {labels ? "Hide tags" : "Show tags"}
      </button>

      {/* The scene isn't keyboard-navigable, so its items are also offered as buttons for keyboard and screen reader users. */}
      <ul className="sr-only" aria-label="Components">
        {schematic.equipment.map((item) => (
          <li key={item.id}>
            <button type="button" aria-pressed={selected?.id === item.id} onClick={() => onSelect(selectionKey(item))}>
              {item.tag ? `${item.tag}, ` : ""}
              {item.name} ({KIND_LABELS[item.kind]})
            </button>
          </li>
        ))}
      </ul>

      <SchematicPanels index={index} selected={selected} connected={litItems} onSelect={onSelect} hasData={hasData} />
    </div>
  );
}
