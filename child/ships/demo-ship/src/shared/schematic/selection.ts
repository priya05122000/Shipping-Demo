import { useMemo } from "react";
import { connectionsOf, type SchematicIndex } from "./geometry";

/**
 * Selection state derived from the viewer's shared selection (SectionViewProps.selectedId): the selected item, the
 * pipes leading from it and the equipment they reach. Used by both the 2D and the 3D views, so they highlight alike.
 */
export function useSchematicSelection(index: SchematicIndex, selectedId: string | null) {
  return useMemo(() => {
    const selected = selectedId ? (index.byKey.get(selectedId) ?? null) : null;
    const links = selected ? connectionsOf(index, selected.id) : { pipes: new Set<string>(), items: new Set<string>() };
    return { selected, ...links };
  }, [index, selectedId]);
}
