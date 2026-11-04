import { COLLECTIONS, type CollectionSlug } from "@/lib/collection-defs";
import { request } from "@/lib/request";
import type { BaseRecord, CollectionSnapshot } from "@/types/records";

export interface CollectionState<T extends BaseRecord> {
  /** Null until the first load finishes. */
  data: CollectionSnapshot<T> | null;
  /** Set when loading failed (e.g. the server isn't reachable). */
  error: string | null;
}

export interface CollectionStore<T extends BaseRecord> {
  slug: CollectionSlug;
  idPrefix: string;
  subscribe: (onChange: () => void) => () => void;
  getSnapshot: () => CollectionState<T>;
  getServerSnapshot: () => CollectionState<T>;
  reload: () => Promise<void>;
  /** `form` holds `name` plus one File per file field. */
  create: (form: FormData) => Promise<T>;
  /** File fields left out of `form` keep their existing file. */
  update: (id: string, form: FormData) => Promise<T>;
  remove: (id: string) => Promise<void>;
}

const LOADING = { data: null, error: null } as const;

/** Client-side cache of one collection, kept in sync with the local data folder through the API. */
export function createCollectionStore<T extends BaseRecord>(slug: CollectionSlug): CollectionStore<T> {
  const url = `/api/${slug}`;
  const listeners = new Set<() => void>();
  let state: CollectionState<T> = LOADING;
  let loading: Promise<void> | null = null;

  function set(next: CollectionState<T>) {
    state = next;
    listeners.forEach((listener) => listener());
  }

  function reload() {
    loading ??= request<CollectionSnapshot<T>>(url)
      .then((data) => set({ data, error: null }))
      .catch((error: Error) => set({ data: state.data, error: error.message }))
      .finally(() => {
        loading = null;
      });
    return loading;
  }

  // Pick up changes made in another tab or browser when the user comes back to this one.
  const onFocus = () => void reload();

  return {
    slug,
    idPrefix: COLLECTIONS[slug].idPrefix,
    subscribe(onChange) {
      listeners.add(onChange);
      if (listeners.size === 1) {
        window.addEventListener("focus", onFocus);
        if (!state.data) void reload();
      }
      return () => {
        listeners.delete(onChange);
        if (listeners.size === 0) window.removeEventListener("focus", onFocus);
      };
    },
    getSnapshot: () => state,
    getServerSnapshot: () => LOADING,
    reload,
    async create(form) {
      const result = await request<{ record: T; snapshot: CollectionSnapshot<T> }>(url, { method: "POST", body: form });
      set({ data: result.snapshot, error: null });
      return result.record;
    },
    async update(id, form) {
      const result = await request<{ record: T; snapshot: CollectionSnapshot<T> }>(`${url}/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: form,
      });
      set({ data: result.snapshot, error: null });
      return result.record;
    },
    async remove(id) {
      const result = await request<{ snapshot: CollectionSnapshot<T> }>(`${url}/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      set({ data: result.snapshot, error: null });
    },
  };
}
