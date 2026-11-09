import { byCreation, fileUrl, folderOf, type StoredFileMeta } from "@/shared/records";
import { readCard, type ObjectCard } from "./card";

/** Shape of an object.json, as written by the Library. Only the fields the viewer uses. */
interface ObjectMeta {
  name?: string;
  createdAt?: string;
  model?: StoredFileMeta;
  lineDiagram?: StoredFileMeta;
}

/** A 3D model with its line diagram, shared by every section of the ship. */
export interface SharedObject {
  /** Folder name, e.g. "OBJ-001". Sections list the objects they use by this ID. */
  id: string;
  name: string;
  /** URL of the 3D model file. */
  model: string | null;
  /** Original file name of the 3D model, e.g. "pump.glb". */
  modelName: string;
  /** Lower-case extension of the 3D model file, e.g. "glb", or "" if it has none. */
  modelFormat: string;
  /** URL of the line diagram image. */
  lineDiagram: string | null;
  /** What code generation learned from the line diagram image (see card.ts), or null until it has looked at this image. */
  card: ObjectCard | null;
}

/** A rectangle in a 2D view, e.g. where ObjectSymbol2D draws an object. */
export interface ObjectBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

// One folder per object, in this folder. Adding, changing or removing one reloads everything that uses it.
const metas = import.meta.glob<ObjectMeta>("./*/object.json", { eager: true, import: "default" });
const urls = import.meta.glob<string>("./*/*.{glb,gltf,obj,fbx,stl,blend,png,jpg,jpeg,webp,svg}", {
  eager: true,
  query: "?url",
  import: "default",
});
// Written by Ship Docs' code generation (see card.ts).
const cards = import.meta.glob<unknown>("./*/card.json", { eager: true, import: "default" });

function extensionOf(file: StoredFileMeta | undefined): string {
  const name = file?.storedName ?? "";
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

/** Every shared object, oldest first. */
export const objects: SharedObject[] = Object.entries(metas)
  .map(([key, meta]) => ({ id: folderOf(key), createdAt: meta.createdAt, meta }))
  .sort(byCreation)
  .map(({ id, meta }) => ({
    id,
    name: meta.name ?? id,
    model: fileUrl(urls, id, meta.model),
    modelName: meta.model?.name ?? "",
    modelFormat: extensionOf(meta.model),
    lineDiagram: fileUrl(urls, id, meta.lineDiagram),
    card: readCard(cards[`./${id}/card.json`], meta.lineDiagram?.storedName),
  }));

export function findObject(id: string): SharedObject | undefined {
  return objects.find((object) => object.id === id);
}

/**
 * Where one of an object's connection points (from its card) is, for the object drawn in `box` by ObjectSymbol2D:
 * the point to draw a pipe to. The box's centre if the object has no card, or no point with that ID.
 */
export function objectPort(id: string, portId: string, box: ObjectBox): { x: number; y: number } {
  const port = findObject(id)?.card?.ports.find((point) => point.id === portId);
  return port
    ? { x: box.x + port.x * box.width, y: box.y + port.y * box.height }
    : { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
