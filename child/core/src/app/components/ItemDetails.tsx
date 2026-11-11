import type { DiagramItem, Section } from "../../sections";
import { CATALOG } from "../../sections/catalog";
import { getItemDetails } from "../../sections/details";
import { Badge } from "../../ui";

/** Details panel for the selected diagram item, read from the section's data.json. */
export function ItemDetails({ section, item }: { section: Section; item: DiagramItem | null }) {
  if (!item) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-500">
        Select a component on the drawing to see its details.
      </div>
    );
  }

  const kind = CATALOG[item.kind];
  const details = getItemDetails(section.data, item.id);

  return (
    <div className="p-4">
      <div className="flex items-center gap-2">
        <Badge color={kind.color}>{item.id}</Badge>
        <Badge>{kind.label}</Badge>
      </div>
      <h2 className="mt-3 text-base font-semibold text-slate-900">{item.label}</h2>
      {details ? (
        <>
          <p className="mt-1 text-sm text-slate-600">{details.description}</p>
          <dl className="mt-4 divide-y divide-slate-100 rounded-lg bg-slate-50 ring-1 ring-slate-200">
            {Object.entries(details.specs).map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 px-3 py-2 text-sm">
                <dt className="text-slate-500">{label}</dt>
                <dd className="text-right font-medium text-slate-900">{value}</dd>
              </div>
            ))}
          </dl>
        </>
      ) : (
        <p className="mt-1 text-sm text-slate-500">No details recorded for this item yet.</p>
      )}
    </div>
  );
}
