import type { ColumnDef } from "@/components/records/types";
import { EyeIcon, PencilIcon, TrashIcon } from "@/components/ui/icons";
import type { BaseRecord } from "@/types/records";

interface RecordTableProps<T extends BaseRecord> {
  records: T[];
  columns: ColumnDef<T>[];
  singular: string;
  onView: (record: T) => void;
  onEdit: (record: T) => void;
  onDelete: (record: T) => void;
}

/** Table on md+ screens, stacked cards on smaller screens. */
export function RecordTable<T extends BaseRecord>({
  records,
  columns,
  singular,
  onView,
  onEdit,
  onDelete,
}: RecordTableProps<T>) {
  const context = { onView };
  const actions = (record: T) => (
    <RowActions
      name={record.name}
      singular={singular}
      onView={() => onView(record)}
      onEdit={() => onEdit(record)}
      onDelete={() => onDelete(record)}
    />
  );

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              {["ID", "Name", ...columns.map((c) => c.header)].map((header) => (
                <th
                  key={header}
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold tracking-wide whitespace-nowrap text-slate-500 uppercase first:pl-6"
                >
                  {header}
                </th>
              ))}
              <th scope="col" className="px-4 py-3 pr-6 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {records.map((record) => (
              <tr key={record.id} className="transition-colors hover:bg-slate-50/70">
                <td className="py-3 pr-4 pl-6 whitespace-nowrap">
                  <IdBadge id={record.id} />
                </td>
                <td className="px-4 py-3">
                  <span className="block max-w-64 truncate text-sm font-medium text-slate-900" title={record.name}>
                    {record.name}
                  </span>
                </td>
                {columns.map((column) => (
                  <td key={column.header} className={`px-4 py-3 ${column.className ?? ""}`}>
                    {column.cell(record, context)}
                  </td>
                ))}
                <td className="py-3 pr-6 pl-4">{actions(record)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-slate-100 md:hidden">
        {records.map((record) => (
          <li key={record.id} className="px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <IdBadge id={record.id} />
                <p className="mt-1.5 truncate text-sm font-semibold text-slate-900">{record.name}</p>
              </div>
              {actions(record)}
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-3">
              {columns.map((column) => (
                <div key={column.header} className="min-w-0">
                  <dt className="mb-1 text-xs font-medium text-slate-500">{column.header}</dt>
                  <dd>{column.cell(record, context)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}

export function IdBadge({ id }: { id: string }) {
  return (
    <span className="inline-flex rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-medium text-slate-700 ring-1 ring-slate-200 ring-inset">
      {id}
    </span>
  );
}

function RowActions({
  name,
  singular,
  onView,
  onEdit,
  onDelete,
}: {
  name: string;
  singular: string;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const base =
    "inline-flex size-8 items-center justify-center rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-indigo-600";
  return (
    <div className="flex shrink-0 justify-end gap-1">
      <button type="button" onClick={onView} className={`${base} text-slate-500 hover:bg-slate-100 hover:text-slate-900`} aria-label={`View ${singular} ${name}`} title="View">
        <EyeIcon className="size-4" />
      </button>
      <button type="button" onClick={onEdit} className={`${base} text-slate-500 hover:bg-indigo-50 hover:text-indigo-700`} aria-label={`Edit ${singular} ${name}`} title="Edit">
        <PencilIcon className="size-4" />
      </button>
      <button type="button" onClick={onDelete} className={`${base} text-slate-500 hover:bg-red-50 hover:text-red-700`} aria-label={`Delete ${singular} ${name}`} title="Delete">
        <TrashIcon className="size-4" />
      </button>
    </div>
  );
}

export function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="divide-y divide-slate-100" aria-busy="true" aria-label="Loading records">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex animate-pulse items-center gap-4 px-6 py-4">
          <div className="h-6 w-16 rounded bg-slate-200" />
          <div className="h-4 w-40 rounded bg-slate-200" />
          <div className="size-12 rounded-lg bg-slate-200" />
          <div className="hidden h-4 w-32 rounded bg-slate-100 sm:block" />
        </div>
      ))}
    </div>
  );
}
