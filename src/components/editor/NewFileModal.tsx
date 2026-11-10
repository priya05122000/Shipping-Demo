"use client";

import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { AlertIcon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/Modal";
import { TextInput } from "@/components/ui/TextInput";
import type { ChildFile, ChildScope } from "@/lib/child-files";
import { childFiles } from "@/lib/child-files-api";
import { COLLECTIONS } from "@/lib/collection-defs";

interface NewFileModalProps {
  /** The editor's scope; the server refuses a path outside it. */
  scope: ChildScope;
  /** Folder the path starts with, e.g. "core/src/app/". */
  folder: string;
  onClose: () => void;
  onCreated: (file: ChildFile) => void;
}

/** "./src//a.ts" or "\src\a.ts" → "src/a.ts". The server checks the result again. */
function normalizePath(value: string): string {
  return value.trim().replaceAll("\\", "/").replace(/\/{2,}/g, "/").replace(/^(\.\/|\/)+/, "");
}

function validatePath(path: string): string | null {
  if (!path) return "Enter a file name.";
  if (path.endsWith("/")) return "Add a file name after the folder.";
  if (path.split("/").some((name) => name === "." || name === "..")) return "Use a path inside the child folder, without “..”.";
  return null;
}

/** New file form. Mount it only while open so its state resets each time. */
export function NewFileModal({ scope, folder, onClose, onCreated }: NewFileModalProps) {
  const [value, setValue] = useState(folder);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // A ref blocks a second submit before the "saving" re-render lands (e.g. double Enter).
  const savingRef = useRef(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (savingRef.current) return;
    const path = normalizePath(value);
    const problem = validatePath(path);
    setError(problem);
    if (problem) return;

    savingRef.current = true;
    setSaving(true);
    try {
      onCreated(await childFiles(scope).create(path));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Something went wrong.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      busy={saving}
      size="sm"
      title="New file"
      description="Creates an empty file in the child app. Folders that don't exist yet are created too."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="new-file-form" loading={saving}>
            {saving ? "Creating…" : "Create file"}
          </Button>
        </>
      }
    >
      <form id="new-file-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        {error && (
          <div role="alert" className="flex gap-3 rounded-lg bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200 ring-inset">
            <AlertIcon className="size-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}
        <TextInput
          label="Path"
          required
          value={value}
          onChange={(event) => setValue(event.target.value)}
          // Start typing after the pre-filled folder.
          onFocus={(event) => event.currentTarget.setSelectionRange(value.length, value.length)}
          placeholder="src/sections/pump/index.ts"
          hint={
            scope === null
              ? `Relative to the child folder, outside ${COLLECTIONS.projects.dir}/.`
              : `Inside this ship's folder, starting with ${scope}/.`
          }
          spellCheck={false}
          autoComplete="off"
          disabled={saving}
          data-autofocus
        />
      </form>
    </Modal>
  );
}
