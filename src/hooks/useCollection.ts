"use client";

import { useSyncExternalStore } from "react";
import type { CollectionState, CollectionStore } from "@/lib/storage";
import type { BaseRecord } from "@/types/records";

/** Subscribes to a collection; loads it from the API on first use. */
export function useCollection<T extends BaseRecord>(store: CollectionStore<T>): CollectionState<T> {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}
