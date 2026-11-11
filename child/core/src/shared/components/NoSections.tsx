import type { NoSectionsProps } from "../../customization";

/** Shown when the ship has no drawings (the NoSections slot's default). */
export function NoSections({ ship }: NoSectionsProps) {
  return (
    <div data-ui="no-sections" className="flex flex-1 items-center justify-center rounded-xl border border-line bg-panel p-6 text-center text-[14px] text-muted">
      No sections yet. Add a section to {ship.name} in the Library, and it will show up here.
    </div>
  );
}
