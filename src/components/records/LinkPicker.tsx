"use client";

import { useState } from "react";
import { IdBadge } from "@/components/records/RecordTable";
import type { LinkFieldConfig } from "@/components/records/types";
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

/** Checkbox list for picking records from another collection, e.g. the objects a section uses. */
export function LinkPicker<T>({ field, value, onChange, disabled }: LinkPickerProps<T>) {
  const { data, error } = useCollection(field.store);
  const [query, setQuery] = useState("");
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
    <fieldset disabled={disabled}>
      <legend className="mb-1.5 block text-sm font-medium text-slate-700">
        {field.label}
        <span className="ml-2 text-xs font-normal text-slate-500">{value.length} selected</span>
      </legend>
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
