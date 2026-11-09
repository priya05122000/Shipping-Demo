import { Component, Suspense, useEffect, useMemo, type ReactNode } from "react";
import { useFBX, useGLTF } from "@react-three/drei";
import { useLoader, type ThreeElements } from "@react-three/fiber";
import { Box3, Group, Mesh, MeshStandardMaterial, Vector3, type Object3D } from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { findObject } from "./objects";

export type ObjectModel3DProps = Omit<ThreeElements["group"], "children" | "id"> & {
  /** The object's ID, e.g. "OBJ-001". */
  id: string;
  /** Length of the model's largest side, in scene units. */
  size?: number;
  /** Colour of a model without its own materials (STL), and of the placeholder box. */
  color?: string;
  /** Draws a selection outline around it. */
  selected?: boolean;
};

/**
 * An object from the Library in a 3D (react-three-fiber) view: its 3D model, scaled so its largest side is `size` and
 * centred on the group's position. GLB, GLTF, OBJ, FBX and STL models are loaded; a BLEND file, a missing model, or
 * one that fails to load shows a plain box instead. Other props (position, rotation, onClick…) go to its group.
 * Import it from "@/objects/ObjectModel3D", so 2D views don't load three.js.
 */
export function ObjectModel3D({ id, size = 1, color = "#94a3b8", selected = false, ...group }: ObjectModel3DProps) {
  const object = findObject(id);
  const placeholder = <Placeholder size={size} color={color} />;
  return (
    <group {...group}>
      <ModelBoundary key={object?.model ?? ""} fallback={placeholder}>
        <Suspense fallback={placeholder}>
          <Model url={object?.model ?? null} format={object?.modelFormat ?? ""} size={size} color={color} fallback={placeholder} />
        </Suspense>
      </ModelBoundary>
      {selected && (
        <mesh>
          <boxGeometry args={[size * 1.15, size * 1.15, size * 1.15]} />
          <meshBasicMaterial color="#4f46e5" wireframe />
        </mesh>
      )}
    </group>
  );
}

function Placeholder({ size, color }: { size: number; color: string }) {
  return (
    <mesh>
      <boxGeometry args={[size, size, size]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

interface ModelProps {
  url: string | null;
  format: string;
  size: number;
  color: string;
  fallback: ReactNode;
}

function Model({ url, format, size, color, fallback }: ModelProps) {
  if (!url) return fallback;
  switch (format) {
    case "glb":
    case "gltf":
      return <GltfModel url={url} size={size} />;
    case "fbx":
      return <FbxModel url={url} size={size} />;
    case "obj":
      return <ObjModel url={url} size={size} />;
    case "stl":
      return <StlModel url={url} size={size} color={color} />;
    default:
      return fallback;
  }
}

function GltfModel({ url, size }: { url: string; size: number }) {
  return <Fitted source={useGLTF(url).scene} size={size} />;
}

function FbxModel({ url, size }: { url: string; size: number }) {
  return <Fitted source={useFBX(url)} size={size} />;
}

function ObjModel({ url, size }: { url: string; size: number }) {
  return <Fitted source={useLoader(OBJLoader, url)} size={size} />;
}

function StlModel({ url, size, color }: { url: string; size: number; color: string }) {
  const geometry = useLoader(STLLoader, url);
  const material = useMemo(() => new MeshStandardMaterial({ color }), [color]);
  useEffect(() => () => material.dispose(), [material]);
  const mesh = useMemo(() => new Mesh(geometry, material), [geometry, material]);
  return <Fitted source={mesh} size={size} />;
}

/** A copy of a loaded model (loaders cache it, so it may be shown several times), centred and scaled to `size`. */
function Fitted({ source, size }: { source: Object3D; size: number }) {
  const fitted = useMemo(() => {
    const copy = source.clone(true);
    const box = new Box3().setFromObject(copy);
    const dimensions = box.getSize(new Vector3());
    const largest = Math.max(dimensions.x, dimensions.y, dimensions.z);
    copy.position.sub(box.getCenter(new Vector3()));
    const wrapper = new Group();
    wrapper.add(copy);
    wrapper.scale.setScalar(largest > 0 ? size / largest : 1);
    return wrapper;
  }, [source, size]);
  return <primitive object={fitted} />;
}

/** Shows `fallback` instead of a model that failed to load, so one bad file doesn't break the scene. */
class ModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
