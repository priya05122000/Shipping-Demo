import { byCreation, fileUrl, folderOf, type StoredFileMeta } from "@/shared/records";

/** Shape of an object.json, as written by the Library. Only the fields the viewer uses. */
interface ObjectMeta {
  name?: string;
  createdAt?: string;
  model?: StoredFileMeta;
  lineDiagram?: StoredFileMeta;
}

/** A 3D model with its line diagram, shared by every section. */
export interface SharedObject {
  /** Folder name, e.g. "OBJ-001". Sections list the objects they use by this ID. */
  id: string;
  name: string;
  /** URL of the 3D model file. */
  model: string | null;
  /** Original file name of the 3D model, e.g. "pump.glb". */
  modelName: string;
  /** URL of the line diagram image. */
  lineDiagram: string | null;
}

// One folder per object, in this folder. Adding, changing or removing one reloads everything that uses it.
const metas = import.meta.glob<ObjectMeta>("./*/object.json", { eager: true, import: "default" });
const urls = import.meta.glob<string>("./*/*.{glb,gltf,obj,fbx,stl,blend,png,jpg,jpeg,webp,svg}", {
  eager: true,
  query: "?url",
  import: "default",
});

/** Every shared object, oldest first. */
export const objects: SharedObject[] = Object.entries(metas)
  .map(([key, meta]) => ({ id: folderOf(key), createdAt: meta.createdAt, meta }))
  .sort(byCreation)
  .map(({ id, meta }) => ({
    id,
    name: meta.name ?? id,
    model: fileUrl(urls, id, meta.model),
    modelName: meta.model?.name ?? "",
    lineDiagram: fileUrl(urls, id, meta.lineDiagram),
  }));

export function findObject(id: string): SharedObject | undefined {
  return objects.find((object) => object.id === id);
}
