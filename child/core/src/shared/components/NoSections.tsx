import type { NoSectionsProps } from "../../customization";

/** Shown when the ship has no drawings (the NoSections slot's default). */
export function NoSections({ ship }: NoSectionsProps) {
  return (
    <div data-ui="no-sections" className="flex flex-1 items-center justify-center rounded-xl bg-white p-6 text-center text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
      No drawings yet. Add a section to {ship.name} in the Library, and it will show up here.
    </div>
  );
}
