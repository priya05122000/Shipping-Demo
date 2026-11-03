"use client";

import { useRef, useState, type FormEvent } from "react";
import { getFile, type ResourceConfig } from "@/components/records/types";
import { Button } from "@/components/ui/Button";
import { FileUpload } from "@/components/ui/FileUpload";
import { AlertIcon, LockIcon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/Modal";
import { TextInput } from "@/components/ui/TextInput";
import { useToast } from "@/components/ui/Toast";
import { useCollection } from "@/hooks/useCollection";
import { formatId } from "@/lib/ids";
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
  const [errors, setErrors] = useState<Errors<T>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // A ref blocks a second submit before the "saving" re-render lands (e.g. double-click / double Enter).
  const savingRef = useRef(false);

  const isEdit = Boolean(record);
  const nextId = data ? formatId(config.store.idPrefix, data.nextSeq) : "";

  function validate(): Errors<T> {
    const result: Errors<T> = {};
    const trimmed = name.trim();
    if (!trimmed) result.name = "Name is required.";
    else if (trimmed.length > NAME_MAX) result.name = `Name must be ${NAME_MAX} characters or fewer.`;
    for (const field of config.fileFields) {
      if (!files[field.key] && !record) result[field.key] = `${field.viewLabel} file is required.`;
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
      description={isEdit ? "Update the name or replace files. Files you don't replace are kept." : config.description}
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
            value={record?.id ?? nextId}
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
            placeholder={`e.g. ${config.id === "manuals" ? "Pump maintenance guide" : "Main pump assembly"}`}
            maxLength={NAME_MAX}
            error={errors.name}
            disabled={saving}
            data-autofocus
          />
        </div>

        {config.fileFields.map((field) => (
          <FileUpload
            key={field.key}
            label={field.label}
            rule={field.rule}
            required
            file={files[field.key] ?? null}
            existing={record ? getFile(record, field.key) : null}
            error={errors[field.key]}
            disabled={saving}
            onFileChange={(file) => {
              setFiles((current) => ({ ...current, [field.key]: file ?? undefined }));
              if (file) setErrors((e) => ({ ...e, [field.key]: undefined }));
            }}
          />
        ))}
      </form>
    </Modal>
  );
}
