import { FileThumbnail } from "@/components/files/FileThumbnail";
import { formatBytes } from "@/lib/files";
import type { StoredFile } from "@/types/records";

/** Clickable thumbnail (opens the View modal). */
export function ThumbnailCell({ file, onClick }: { file: StoredFile; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
      aria-label={`Preview ${file.name}`}
    >
      <FileThumbnail src={file.url} name={file.name} extension={file.extension} />
    </button>
  );
}

export function FileNameCell({ file }: { file: StoredFile }) {
  return (
    <div className="min-w-0">
      <p className="max-w-56 truncate text-sm text-slate-700" title={file.name}>
        {file.name}
      </p>
      <p className="text-xs text-slate-400">
        {file.extension.toUpperCase()} · {formatBytes(file.size)}
      </p>
    </div>
  );
}

/** Thumbnail + file name side by side, for columns that represent a single file. */
export function FileSummaryCell({ file, onClick }: { file: StoredFile; onClick: () => void }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <ThumbnailCell file={file} onClick={onClick} />
      <FileNameCell file={file} />
    </div>
  );
}
