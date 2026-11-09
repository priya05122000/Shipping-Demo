import { collectionDir } from "@/lib/collection-defs";
import { createCollectionStore, type CollectionStore } from "@/lib/storage";
import type { ObjectRecord, Project, Section } from "@/types/records";

export const projectStore = createCollectionStore<Project>("projects", {
  url: "/api/projects",
  dir: collectionDir("projects"),
});

export interface ProjectStores {
  sections: CollectionStore<Section>;
  objects: CollectionStore<ObjectRecord>;
}

// A project's folder never changes, so its stores can be kept for as long as the page is open.
const byProject = new Map<string, ProjectStores>();

/** The stores of one ship's sections and objects. The same objects every time for the same project. */
export function projectStores(project: Pick<Project, "id" | "folder">): ProjectStores {
  let stores = byProject.get(project.id);
  if (!stores) {
    const base = `/api/projects/${encodeURIComponent(project.id)}`;
    stores = {
      sections: createCollectionStore<Section>("sections", {
        url: `${base}/sections`,
        dir: collectionDir("sections", project.folder),
      }),
      objects: createCollectionStore<ObjectRecord>("objects", {
        url: `${base}/objects`,
        dir: collectionDir("objects", project.folder),
      }),
    };
    byProject.set(project.id, stores);
  }
  return stores;
}
