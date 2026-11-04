import { createCollectionStore } from "@/lib/storage";
import type { ObjectRecord, Section } from "@/types/records";

export const sectionStore = createCollectionStore<Section>("sections");
export const objectStore = createCollectionStore<ObjectRecord>("objects");
