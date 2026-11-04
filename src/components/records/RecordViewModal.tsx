"use client";

import { FileDetails } from "@/components/files/FileDetails";
import { IdBadge } from "@/components/records/RecordTable";
import { getFile, type ResourceConfig } from "@/components/records/types";
import { Button } from "@/components/ui/Button";
import { PencilIcon, TrashIcon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/Modal";
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
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`${config.label} details`}
      footer={
        <>
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
        {config.fileFields.map((field) => (
          <FileDetails key={field.key} label={field.viewLabel} file={getFile(record, field.key)} />
        ))}
      </div>
    </Modal>
  );
}
