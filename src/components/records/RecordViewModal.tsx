"use client";

import Link from "next/link";
import { FileDetails } from "@/components/files/FileDetails";
import { IdBadge } from "@/components/records/RecordTable";
import { getFile, getLinks, type LinkFieldConfig, type ResourceConfig } from "@/components/records/types";
import { Button } from "@/components/ui/Button";
import { ExternalIcon, PencilIcon, TrashIcon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/Modal";
import { useCollection } from "@/hooks/useCollection";
import { formatDateTime } from "@/lib/format";
import type { BaseRecord } from "@/types/records";

interface RecordViewModalProps<T extends BaseRecord> {
  config: ResourceConfig<T>;
  record: T;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function RecordViewModal<T extends BaseRecord>({ config, record, onClose, onEdit, onDelete }: RecordViewModalProps<T>) {
  const viewLink = config.viewLink?.(record);
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`${config.label} details`}
      footer={
        <>
          {viewLink && (
            <Link
              href={viewLink.href}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-300 ring-inset hover:bg-slate-50 sm:mr-auto"
            >
              <ExternalIcon className="size-4" /> {viewLink.label}
            </Link>
          )}
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button variant="secondary" onClick={onDelete} className="text-red-600">
            <TrashIcon className="size-4" /> Delete
          </Button>
          <Button onClick={onEdit}>
            <PencilIcon className="size-4" /> Edit
          </Button>
        </>
      }
    >
      <dl className="grid gap-4 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-slate-500">ID</dt>
          <dd className="mt-1">
            <IdBadge id={record.id} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Name</dt>
          <dd className="mt-1 text-sm font-semibold wrap-break-words text-slate-900">{record.name}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs text-slate-500">Folder</dt>
          <dd className="mt-1 font-mono text-xs break-all text-slate-700">
            child/{config.store.dir}/{record.folder}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Created</dt>
          <dd className="mt-1 text-sm text-slate-900">{formatDateTime(record.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Last updated</dt>
          <dd className="mt-1 text-sm text-slate-900">{formatDateTime(record.updatedAt)}</dd>
        </div>
      </dl>

      <div className="mt-5 space-y-5">
        {config.links?.map((field) => (
          <LinkedRecords key={field.key} field={field} ids={getLinks(record, field.key)} />
        ))}
        {config.fileFields.map((field) => {
          const file = getFile(record, field.key);
          return file ? (
            <FileDetails key={field.key} label={field.viewLabel} file={file} />
          ) : (
            <section key={field.key} className="rounded-xl p-4 ring-1 ring-slate-200">
              <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{field.viewLabel}</h3>
              <p className="mt-2 text-sm text-slate-500">Not added yet. Use Edit to upload one.</p>
            </section>
          );
        })}
      </div>
    </Modal>
  );
}

/** The records a link field points at, e.g. a section's objects. */
function LinkedRecords<T>({ field, ids }: { field: LinkFieldConfig<T>; ids: string[] }) {
  const { data } = useCollection(field.store);
  const names = new Map(data?.items.map((item) => [item.id, item.name]));
  return (
    <section className="rounded-xl p-4 ring-1 ring-slate-200">
      <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
        {field.label} <span className="font-normal normal-case">({ids.length})</span>
      </h3>
      {ids.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">None picked yet. Use Edit to pick some.</p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2">
          {ids.map((id) => (
            <li key={id} className="flex items-center gap-2 rounded-lg bg-slate-50 py-1 pr-3 pl-1 ring-1 ring-slate-200">
              <IdBadge id={id} />
              <span className="text-sm text-slate-900">
                {data ? (names.get(id) ?? <span className="text-slate-400 italic">No longer exists</span>) : "…"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
