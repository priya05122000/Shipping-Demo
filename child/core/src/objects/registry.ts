import type { ObjectFiles, ObjectMeta } from "../manifest";
import { byCreation, fileUrl, folderOf, type StoredFileMeta } from "../shared/records";
import { readCard, type ObjectCard } from "./card";

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

function extensionOf(file: StoredFileMeta | undefined): string {
  const name = file?.storedName ?? "";
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

/** Every shared object in a ship's src/objects (one folder each), oldest first. */
export function buildObjects({ metas, urls, cards }: ObjectFiles): SharedObject[] {
  return Object.entries(metas)
    .map(([key, meta]: [string, ObjectMeta]) => ({ id: folderOf(key), createdAt: meta.createdAt, meta }))
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
}
