import Link from "next/link";
import { plural } from "@/components/records/configs";
import { IdBadge } from "@/components/records/RecordTable";
import { ChevronRightIcon, PencilIcon, ShipIcon, TrashIcon } from "@/components/ui/icons";
import { projectStore } from "@/lib/collections";
import { formatDateTime } from "@/lib/format";
import type { Project } from "@/types/records";

interface ProjectCardProps {
  project: Project;
  onEdit: () => void;
  onDelete: () => void;
}

const ICON_BUTTON =
  "inline-flex size-8 items-center justify-center rounded-lg text-slate-500 transition-colors focus-visible:outline-2 focus-visible:outline-indigo-600";

/** One ship on the projects page: its details, and links to open, edit or delete it. */
export function ProjectCard({ project, onEdit, onDelete }: ProjectCardProps) {
  const href = `/projects/${encodeURIComponent(project.id)}`;
  return (
    <li className="flex flex-col rounded-2xl bg-white p-5 shadow-[0_0_0_1px_rgb(15_23_42/0.08),0_2px_4px_rgb(15_23_42/0.06),0_8px_24px_rgb(15_23_42/0.10)] transition-shadow hover:shadow-[0_0_0_1px_rgb(79_70_229/0.25),0_2px_4px_rgb(15_23_42/0.06),0_8px_24px_rgb(15_23_42/0.12)]">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-indigo-500 to-violet-600 text-white shadow-md ring-1 shadow-indigo-500/25 ring-white/20 ring-inset">
          <ShipIcon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold tracking-tight text-slate-950" title={project.name}>
            <Link href={href} className="hover:text-indigo-700 focus-visible:outline-2 focus-visible:outline-indigo-600">
              {project.name}
            </Link>
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <IdBadge id={project.id} />
            {project.vesselType && (
              <span className="inline-flex rounded-lg bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200/70 ring-inset">
                {project.vesselType}
              </span>
            )}
          </div>
        </div>
        <div className="-mt-1 -mr-1 flex shrink-0 gap-0.5">
          <button
            type="button"
            onClick={onEdit}
            className={`${ICON_BUTTON} hover:bg-indigo-50 hover:text-indigo-700`}
            aria-label={`Edit ship ${project.name}`}
            title="Edit"
          >
            <PencilIcon className="size-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className={`${ICON_BUTTON} hover:bg-red-50 hover:text-red-700`}
            aria-label={`Delete ship ${project.name}`}
            title="Delete"
          >
            <TrashIcon className="size-4" />
          </button>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-slate-500">IMO number</dt>
          <dd className={`mt-0.5 font-mono ${project.imoNumber ? "text-slate-900" : "text-slate-400"}`}>
            {project.imoNumber ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Contents</dt>
          <dd className="mt-0.5 text-slate-900">
            {plural(project.sectionCount, "section")} · {plural(project.objectCount, "object")}
          </dd>
        </div>
      </dl>
      <p className={`mt-3 line-clamp-2 min-h-10 text-sm ${project.description ? "text-slate-600" : "text-slate-400"}`}>
        {project.description ?? "No description."}
      </p>
      <p className="mt-3 truncate font-mono text-xs text-slate-500" title="The ship's standalone viewer project">
        child/{projectStore.dir}/{project.folder}
      </p>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <p className="truncate text-xs text-slate-500">Updated {formatDateTime(project.updatedAt)}</p>
        <Link
          href={href}
          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg bg-slate-950 px-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          Open <ChevronRightIcon className="size-4" />
        </Link>
      </div>
    </li>
  );
}

export function ProjectCardSkeleton() {
  return (
    <li className="animate-pulse rounded-2xl bg-white p-5 shadow-[0_0_0_1px_rgb(15_23_42/0.08)]">
      <div className="flex gap-3">
        <div className="size-10 rounded-xl bg-slate-100" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-36 rounded bg-slate-100" />
          <div className="h-5 w-20 rounded-lg bg-slate-100" />
        </div>
      </div>
      <div className="mt-5 h-10 rounded bg-slate-100" />
      <div className="mt-4 h-8 rounded bg-slate-100" />
    </li>
  );
}
