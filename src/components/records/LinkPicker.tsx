"use client";

import { useId, useState } from "react";
import { IdBadge } from "@/components/records/RecordTable";
import type { LinkFieldConfig } from "@/components/records/types";
import { ChevronDownIcon } from "@/components/ui/icons";
import { SearchInput } from "@/components/ui/SearchInput";
import { useCollection } from "@/hooks/useCollection";

/** Show a search box once the list is longer than this. */
const SEARCH_FROM = 6;

interface LinkPickerProps<T> {
  field: LinkFieldConfig<T>;
  /** Picked IDs, in the order they were picked. */
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

/**
 * Checkbox list for picking records from another collection, e.g. the objects a section uses. Its heading row (label,
 * count and arrow) is one button that shows and hides the list.
 */
export function LinkPicker<T>({ field, value, onChange, disabled }: LinkPickerProps<T>) {
  const { data, error } = useCollection(field.store);
  const [query, setQuery] = useState("");
  // Closed at first, so a long list doesn't push the rest of the form down.
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const labelId = useId();
  const noun = field.label.toLowerCase();

  const items = data?.items ?? [];
  const q = query.trim().toLowerCase();
  const filtered = q ? items.filter((r) => r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q)) : items;
  // Picked earlier, but since deleted (e.g. by hand). Listed so they can be unticked.
  const missing = data ? value.filter((id) => !items.some((item) => item.id === id)) : [];

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  }

  const status = !data
    ? error
      ? `Couldn't load ${noun}: ${error}`
      : "Loading…"
    : items.length === 0
      ? `No ${noun} yet. Add them in the ${field.label} tab.`
      : filtered.length === 0
        ? `No ${noun} match “${query.trim()}”.`
        : null;

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        title={open ? `Hide ${noun}` : `Show ${noun}`}
        onClick={() => setOpen((current) => !current)}
        className="group mb-1.5 flex w-full items-center justify-between gap-3 rounded-lg py-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
      >
        <span id={labelId} className="text-sm font-medium text-slate-700">
          {field.label}
          <span className="ml-2 text-xs font-normal text-slate-500">{value.length} selected</span>
        </span>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors group-hover:bg-slate-100 group-hover:text-slate-900">
          <ChevronDownIcon className={`size-5 transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      <fieldset id={panelId} hidden={!open} disabled={disabled} aria-labelledby={labelId}>
        <p className="mb-2 text-xs text-slate-500">{field.hint}</p>
        <div className="overflow-hidden rounded-xl border border-slate-200">
          {items.length > SEARCH_FROM && (
            <div className="border-b border-slate-200 bg-slate-50 p-2 sm:[&>div]:w-full">
              <SearchInput value={query} onChange={setQuery} label={`Search ${noun}`} placeholder="Search by name or ID…" />
            </div>
          )}
          <ul className="max-h-56 divide-y divide-slate-100 overflow-y-auto">
            {missing.map((id) => (
              <PickerRow key={id} id={id} name="No longer exists" checked onToggle={() => toggle(id)} muted />
            ))}
            {filtered.map((item) => (
              <PickerRow
                key={item.id}
                id={item.id}
                name={item.name}
                checked={value.includes(item.id)}
                onToggle={() => toggle(item.id)}
              />
            ))}
          </ul>
          {status && <p className="px-3 py-4 text-center text-sm text-slate-500">{status}</p>}
        </div>
      </fieldset>
    </div>
  );
}

function PickerRow({
  id,
  name,
  checked,
  onToggle,
  muted,
}: {
  id: string;
  name: string;
  checked: boolean;
  onToggle: () => void;
  muted?: boolean;
}) {
  return (
    <li>
      <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-slate-50">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="size-4 shrink-0 rounded border-slate-300 accent-indigo-600"
        />
        <IdBadge id={id} />
        <span className={`min-w-0 truncate text-sm ${muted ? "text-slate-400 italic" : "text-slate-900"}`}>{name}</span>
      </label>
    </li>
  );
}
