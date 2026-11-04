"use client";

import { useRef, useState, type FormEvent } from "react";
import { LinkPicker } from "@/components/records/LinkPicker";
import { getFile, getLinks, type ResourceConfig } from "@/components/records/types";
import { Button } from "@/components/ui/Button";
import { FileUpload } from "@/components/ui/FileUpload";
import { AlertIcon, LockIcon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/Modal";
import { TextInput } from "@/components/ui/TextInput";
import { useToast } from "@/components/ui/Toast";
import { useCollection } from "@/hooks/useCollection";
import { formatId, slugify } from "@/lib/ids";
import type { BaseRecord, FileKey } from "@/types/records";

const NAME_MAX = 100;

interface RecordFormModalProps<T extends BaseRecord> {
  config: ResourceConfig<T>;
  /** Record being edited; omit to add a new one. */
  record?: T;
  onClose: () => void;
  onSaved: (record: T, mode: "add" | "edit") => void;
}

type Errors<T> = Partial<Record<"name" | FileKey<T>, string>>;

/** Add/Edit form. Mount it only while open so its state resets each time. */
export function RecordFormModal<T extends BaseRecord>({ config, record, onClose, onSaved }: RecordFormModalProps<T>) {
  const toast = useToast();
  const { data } = useCollection(config.store);
  const [name, setName] = useState(record?.name ?? "");
  const [files, setFiles] = useState<Partial<Record<FileKey<T>, File>>>({});
  // Optional existing files to remove on save.
  const [removed, setRemoved] = useState<Partial<Record<FileKey<T>, boolean>>>({});
  const [links, setLinks] = useState<Record<string, string[]>>(() =>
    Object.fromEntries((config.links ?? []).map((field) => [field.key, record ? getLinks(record, field.key) : []])),
  );
  const [errors, setErrors] = useState<Errors<T>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // A ref blocks a second submit before the "saving" re-render lands (e.g. double-click / double Enter).
  const savingRef = useRef(false);

  const isEdit = Boolean(record);
  const { idPrefix, folderFromName, dir } = config.store;
  const shownId = record?.id ?? (data ? formatId(idPrefix, data.nextSeq) : "");
  // Records whose folder is named from the name show where it will be (or is); the folder never changes after that.
  const folder = record?.folder ?? slugify(name);
  const nameHint = folderFromName ? (
    <>
      Folder: <code className="font-mono">child/{dir}/{folder || "…"}</code>
      {isEdit && " · stays the same when renamed"}
    </>
  ) : undefined;

  function validate(): Errors<T> {
    const result: Errors<T> = {};
    const trimmed = name.trim();
    if (!trimmed) result.name = "Name is required.";
    else if (trimmed.length > NAME_MAX) result.name = `Name must be ${NAME_MAX} characters or fewer.`;
    else if (folderFromName && !record && !slugify(trimmed)) {
      result.name = "Use at least one letter or digit (A–Z, 0–9), so the name can become a folder name.";
    }
    for (const field of config.fileFields) {
      if (field.required && !files[field.key] && !record) result[field.key] = `${field.viewLabel} file is required.`;
    }
    return result;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (savingRef.current) return;

    const found = validate();
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) return;

    savingRef.current = true;
    setSaving(true);
    try {
      const form = new FormData();
      form.set("name", name.trim());
      // Only new files are sent; on edit the server keeps the existing file for any field left out.
      for (const field of config.fileFields) {
        const picked = files[field.key];
        if (picked) form.set(field.key, picked);
        else if (removed[field.key]) form.append("remove", field.key);
      }
      // Links are always sent in full: the server replaces the stored list.
      for (const [key, ids] of Object.entries(links)) {
        for (const id of ids) form.append(key, id);
      }
      const saved = record ? await config.store.update(record.id, form) : await config.store.create(form);
      onSaved(saved, isEdit ? "edit" : "add");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong.";
      setFormError(message);
      toast.error(`Couldn't save ${config.singular}`, message);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const formId = `${config.id}-form`;
  return (
    <Modal
      open
      onClose={onClose}
      busy={saving}
      title={isEdit ? `Edit ${config.label}` : `Add ${config.label}`}
      description={isEdit ? "Update the name or files. Files you don't change are kept." : config.description}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : `Add ${config.label}`}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} noValidate className="space-y-5">
        {formError && (
          <div role="alert" className="flex gap-3 rounded-lg bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200 ring-inset">
            <AlertIcon className="size-5 shrink-0" />
            <p>{formError}</p>
          </div>
        )}

        <div className="grid gap-5 sm:grid-cols-[10rem_1fr]">
          <TextInput
            label="ID"
            value={shownId}
            title={shownId}
            placeholder="—"
            locked
            tabIndex={-1}
            icon={<LockIcon className="size-4" />}
            hint={isEdit ? "Read-only" : "Assigned on save"}
          />
          <TextInput
            label="Name"
            required
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (errors.name) setErrors((e) => ({ ...e, name: undefined }));
            }}
            placeholder={`e.g. ${config.namePlaceholder}`}
            maxLength={NAME_MAX}
            error={errors.name}
            hint={nameHint}
            disabled={saving}
            data-autofocus
          />
        </div>

        {config.fileFields.map((field) => (
          <FileUpload
            key={field.key}
            label={field.label}
            rule={field.rule}
            required={field.required}
            file={files[field.key] ?? null}
            existing={record ? getFile(record, field.key) : null}
            error={errors[field.key]}
            disabled={saving}
            removed={Boolean(removed[field.key])}
            onRemovedChange={
              field.required ? undefined : (value) => setRemoved((current) => ({ ...current, [field.key]: value }))
            }
            onFileChange={(file) => {
              setFiles((current) => ({ ...current, [field.key]: file ?? undefined }));
              if (file) {
                setErrors((e) => ({ ...e, [field.key]: undefined }));
                // A new file replaces the current one, so it's no longer "to be removed".
                setRemoved((current) => ({ ...current, [field.key]: false }));
              }
            }}
          />
        ))}

        {config.links?.map((field) => (
          <LinkPicker
            key={field.key}
            field={field}
            value={links[field.key] ?? []}
            onChange={(ids) => setLinks((current) => ({ ...current, [field.key]: ids }))}
            disabled={saving}
          />
        ))}
      </form>
    </Modal>
  );
}
