import { createCollectionStore } from "@/lib/storage";
import type { LineDiagram, Manual, ObjectRecord } from "@/types/records";

export const lineDiagramStore = createCollectionStore<LineDiagram>("line-diagrams");
export const objectStore = createCollectionStore<ObjectRecord>("objects");
export const manualStore = createCollectionStore<Manual>("manuals");
