import {
  createContext,
  use,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { Section } from "./section";

/*
 * What a section's views (its Diagram2D.tsx and Diagram3D.tsx, and a ship's own views) can ask the viewer for, besides
 * their props: the section, what the Library read from its manual, and state they share. The viewer provides them
 * around the open section; a view rendered anywhere else gets no section, no records, and state of its own.
 */

/** One record of a section's manual-data.json, as the Library writes it from the manual: any fields, and an id. */
export interface ManualRecord {
  /** The component's engineering tag, e.g. "FB112". */
  id: string;
  [field: string]: unknown;
}

/** State kept for the open section, whichever of its views is showing (see useSectionState). */
class SectionState {
  private values = new Map<string, unknown>();
  private listeners = new Map<string, Set<() => void>>();

  /** Sets a value the first time it's asked for, during render, so without telling anyone. */
  init(key: string, value: () => unknown) {
    if (!this.values.has(key)) this.values.set(key, value());
  }

  get(key: string) {
    return this.values.get(key);
  }

  set(key: string, value: unknown) {
    if (this.values.has(key) && Object.is(this.values.get(key), value)) return;
    this.values.set(key, value);
    for (const listener of this.listeners.get(key) ?? []) listener();
  }

  subscribe(key: string, listener: () => void) {
    let set = this.listeners.get(key);
    if (!set) this.listeners.set(key, (set = new Set()));
    set.add(listener);
    return () => set.delete(listener);
  }
}

const SectionContext = createContext<{ section: Section; state: SectionState } | null>(null);

/**
 * Gives the views of `section` what they can ask for. Give it `key={section.id}`, so state starts afresh for each
 * section (it's kept while the section's views change, and through hot updates of its files).
 */
export function SectionProvider({ section, children }: { section: Section; children: ReactNode }) {
  const [state] = useState(() => new SectionState());
  const value = useMemo(() => ({ section, state }), [section, state]);
  return <SectionContext value={value}>{children}</SectionContext>;
}

/** The section the view shows; null when it's rendered outside the viewer. */
export function useSection(): Section | null {
  return useContext(SectionContext)?.section ?? null;
}

const NO_RECORDS: ManualRecord[] = [];
const loading = new WeakMap<() => Promise<unknown>, Promise<ManualRecord[]>>();

/** The section's manual-data.json, read once per file; records without an id are skipped. */
function manualRecords(load: () => Promise<unknown>): Promise<ManualRecord[]> {
  let records = loading.get(load);
  if (!records) {
    records = load()
      .then((raw) =>
        Array.isArray(raw)
          ? raw.filter((r): r is ManualRecord => !!r && typeof r === "object" && typeof (r as ManualRecord).id === "string" && (r as ManualRecord).id !== "")
          : NO_RECORDS,
      )
      .catch((error: unknown) => {
        console.warn("The section's manual-data.json couldn't be loaded:", error);
        return NO_RECORDS;
      });
    loading.set(load, records);
  }
  return records;
}

/**
 * The records the Library read from the section's manual (its manual-data.json), the source of its components'
 * engineering data; empty when it has no manual. Suspends until they've loaded, so render the view inside Suspense (the
 * viewer does). The Library writes the file again when a new manual is uploaded, so read the fields you need and allow
 * for any of them to be missing.
 */
export function useManualData(): ManualRecord[] {
  const load = useSection()?.loadManualData;
  return load ? use(manualRecords(load)) : NO_RECORDS;
}

/**
 * Like useState, but kept for the open section while its views change: e.g. a simulation started in the 2D view goes
 * on in the 3D view. `key` names it within the section, so prefix it with what owns it, e.g. "pipeline:flow".
 */
export function useSectionState<T>(key: string, initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const provided = useContext(SectionContext)?.state;
  const [own] = useState(() => new SectionState());
  const state = provided ?? own;
  state.init(key, () => (typeof initial === "function" ? (initial as () => T)() : initial));
  const subscribe = useCallback((listener: () => void) => state.subscribe(key, listener), [state, key]);
  const value = useSyncExternalStore(subscribe, () => state.get(key) as T);
  const setValue = useCallback<Dispatch<SetStateAction<T>>>(
    (next) => {
      const previous = state.get(key) as T;
      state.set(key, typeof next === "function" ? (next as (value: T) => T)(previous) : next);
    },
    [state, key],
  );
  return [value, setValue];
}
