"use client";

import { useEffect, useMemo } from "react";

/** Shared, ref-counted blob URLs so StrictMode remounts don't revoke a URL that's still in use. */
const urls = new Map<File, { url: string; refs: number }>();

function acquire(file: File): string {
  let entry = urls.get(file);
  if (!entry) {
    entry = { url: URL.createObjectURL(file), refs: 0 };
    urls.set(file, entry);
  }
  return entry.url;
}

function retain(file: File) {
  const entry = urls.get(file);
  if (entry) entry.refs++;
}

function release(file: File) {
  const entry = urls.get(file);
  if (!entry) return;
  entry.refs--;
  // Defer so an immediate remount (StrictMode, re-render with same file) can retain it again.
  setTimeout(() => {
    if (entry.refs <= 0 && urls.get(file) === entry) {
      URL.revokeObjectURL(entry.url);
      urls.delete(file);
    }
  }, 1000);
}

/** Returns a blob: URL to preview a not-yet-uploaded File, revoked once no component uses it. */
export function useObjectUrl(file: File | null | undefined): string | null {
  const url = useMemo(() => (file && typeof window !== "undefined" ? acquire(file) : null), [file]);

  useEffect(() => {
    if (!file) return;
    retain(file);
    return () => release(file);
  }, [file]);

  return url;
}
