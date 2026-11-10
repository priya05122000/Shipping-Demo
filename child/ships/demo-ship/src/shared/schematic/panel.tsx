import { useState } from "react";
import { findObject } from "@shipdocs/viewer-core/objects";
import { Badge } from "@shipdocs/viewer-core/ui";
import type { SchematicIndex } from "./geometry";
import { selectionKey, type Equipment, type EquipmentKind, type MappingStatus } from "./types";

/*
 * Plain DOM overlays shared by the 2D and 3D views (no SVG, no three.js): an overview of the section and a callout for
 * the selected item. Both read only the schematic; the section's data.json, when it has one, is the viewer's to show.
 */

export const KIND_LABELS: Record<EquipmentKind, string> = {
  tank: "Tank",
  valve: "Valve",
  "angle-valve": "Angle valve",
  "relief-valve": "Relief valve",
  gauge: "Pressure gauge",
  spool: "Flanged spool",
  "end-flange": "Manifold connection",
  "open-end": "Open end / vent",
};

export const STATUS_LABELS: Record<MappingStatus, string> = {
  verified: "Verified",
  "partially-verified": "Partially verified",
  ambiguous: "Ambiguous",
  "missing-data": "Missing data",
  unmatched: "Unmatched",
};

const STATUS_COLORS: Record<MappingStatus, string> = {
  verified: "#15803d",
  "partially-verified": "#0369a1",
  ambiguous: "#b45309",
  "missing-data": "#64748b",
  unmatched: "#b91c1c",
};

function objectName(id: string): string {
  return findObject(id)?.name ?? id;
}

function count<T extends string>(values: T[]): [T, number][] {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()];
}

export interface SchematicPanelsProps {
  index: SchematicIndex;
  selected: Equipment | null;
  /** Instance IDs of the equipment joined to the selected item. */
  connected: Set<string>;
  onSelect: (id: string | null) => void;
  /** Whether the data.json records were found for the section (false: none yet). */
  hasData: boolean;
}

/** The overview (toggle, top left) and the selected item's callout (top right), over a view. */
export function SchematicPanels({ index, selected, connected, onSelect, hasData }: SchematicPanelsProps) {
  const [overview, setOverview] = useState(false);
  const { schematic } = index;
  const unresolved = schematic.pipes.filter((pipe) => pipe.status === "unresolved").length;
  const tagged = schematic.equipment.filter((item) => item.tag).length;

  return (
    <>
      <div className="pointer-events-none absolute top-2 left-2 z-10 flex max-h-[calc(100%-1rem)] w-64 flex-col gap-2">
        <button
          type="button"
          onClick={() => setOverview((open) => !open)}
          aria-expanded={overview}
          className="pointer-events-auto self-start rounded-md bg-white/90 px-2 py-1 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-accent-50 focus-visible:outline-2 focus-visible:outline-accent-600"
        >
          {overview ? "Hide overview" : "Overview"}
        </button>
        {overview && (
          <section aria-label="Section overview" className="pointer-events-auto overflow-y-auto rounded-lg bg-white/95 p-3 text-xs text-slate-700 shadow-sm ring-1 ring-slate-200">
            <p className="font-semibold text-slate-900">
              {schematic.equipment.length} components · {tagged} tagged · {schematic.pipes.length} pipe runs
            </p>
            <h3 className="mt-2 font-medium text-slate-500">Fluids</h3>
            <ul className="mt-1 space-y-0.5">
              {Object.values(schematic.fluids).map((fluid) => (
                <li key={fluid.id} className="flex items-center gap-2">
                  <span className="inline-block h-1 w-5 rounded" style={{ backgroundColor: fluid.color }} />
                  {fluid.label}
                </li>
              ))}
            </ul>
            <h3 className="mt-2 font-medium text-slate-500">Equipment</h3>
            <ul className="mt-1 space-y-0.5">
              {count(schematic.equipment.map((item) => item.kind)).map(([kind, n]) => (
                <li key={kind} className="flex justify-between">
                  <span>{KIND_LABELS[kind]}</span>
                  <span className="font-medium">{n}</span>
                </li>
              ))}
            </ul>
            <h3 className="mt-2 font-medium text-slate-500">Mapping</h3>
            <ul className="mt-1 space-y-0.5">
              {count(schematic.equipment.map((item) => item.status)).map(([status, n]) => (
                <li key={status} className="flex justify-between">
                  <span style={{ color: STATUS_COLORS[status] }}>{STATUS_LABELS[status]}</span>
                  <span className="font-medium">{n}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-slate-500">
              {unresolved > 0 && `${unresolved} pipe run${unresolved === 1 ? "" : "s"} leave the drawing (destination not shown). `}
              {hasData
                ? "Engineering data from the section's data.json."
                : "No engineering data yet: the section has no data.json, so no specifications, operating states, alarms or flow animation are shown."}
            </p>
          </section>
        )}
      </div>

      {selected && (
        <aside
          aria-label="Selected component"
          aria-live="polite"
          className="absolute top-2 right-2 z-10 max-h-[calc(100%-1rem)] w-72 overflow-y-auto rounded-lg bg-white/95 p-3 text-xs text-slate-700 shadow-sm ring-1 ring-slate-200"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge color={schematic.fluids[selected.fluid]?.color}>{selectionKey(selected)}</Badge>
              <Badge>{KIND_LABELS[selected.kind]}</Badge>
              <Badge color={STATUS_COLORS[selected.status]}>{STATUS_LABELS[selected.status]}</Badge>
            </div>
            <button
              type="button"
              onClick={() => onSelect(null)}
              aria-label="Clear selection"
              className="rounded px-1 text-slate-400 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-accent-600"
            >
              ✕
            </button>
          </div>
          <h2 className="mt-2 text-sm font-semibold text-slate-900">{selected.name}</h2>
          <dl className="mt-2 divide-y divide-slate-100 rounded-md bg-slate-50 ring-1 ring-slate-200">
            <Row label="Instance ID" value={selected.id} />
            <Row label="Fluid" value={schematic.fluids[selected.fluid]?.label ?? selected.fluid} />
            <Row label="Library object" value={selected.object ? `${selected.object} · ${objectName(selected.object)}` : "None (shared symbol)"} />
            {selected.candidates && selected.candidates.length > 0 && (
              <Row label="Candidates" value={selected.candidates.map((id) => `${id} · ${objectName(id)}`).join(", ")} />
            )}
            <Row label="data.json record" value={selected.record ?? "None"} />
            {selected.manualRecord && <Row label="Manual extract entry" value={selected.manualRecord} />}
          </dl>
          {selected.note && <p className="mt-2 text-slate-600">{selected.note}</p>}
          {connected.size > 0 && (
            <>
              <h3 className="mt-2 font-medium text-slate-500">Connected through pipes</h3>
              <ul className="mt-1 flex flex-wrap gap-1">
                {[...connected].map((id) => {
                  const item = index.equipment.get(id);
                  if (!item) return null;
                  const key = selectionKey(item);
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        onClick={() => onSelect(key)}
                        className="rounded bg-slate-100 px-1.5 py-0.5 hover:bg-accent-50 hover:text-accent-700 focus-visible:outline-2 focus-visible:outline-accent-600"
                      >
                        {item.tag ?? item.name}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </aside>
      )}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 px-2 py-1">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="text-right font-medium break-words text-slate-900">{value}</dd>
    </div>
  );
}
