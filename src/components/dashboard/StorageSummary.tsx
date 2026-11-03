import { DatabaseIcon } from "@/components/ui/icons";
import { formatBytes } from "@/lib/files";

/** Where files are stored and how much space they take on disk. */
export function StorageSummary({ totalBytes }: { totalBytes: number | null }) {
  return (
    <div className="flex w-full items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200 sm:w-auto">
      <DatabaseIcon className="size-5 shrink-0 text-slate-400" />
      <div className="min-w-0 text-xs">
        <p className="font-medium text-slate-700">
          Saved to <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-slate-700">./data</code> on this computer
        </p>
        <p className="mt-0.5 text-slate-500 tabular-nums">
          {totalBytes === null ? "Loading…" : `${formatBytes(totalBytes)} of uploaded files`}
        </p>
      </div>
    </div>
  );
}
