"use client";

import { FileThumbnail } from "@/components/files/FileThumbnail";
import { DownloadIcon, ExternalIcon } from "@/components/ui/icons";
import { fileKindFromExtension, formatBytes } from "@/lib/files";
import { formatDateTime } from "@/lib/format";
import type { StoredFile } from "@/types/records";

const KIND_LABEL = { image: "Image", model3d: "3D model", pdf: "PDF document" };

/** Full preview + metadata for a stored file, used in the View modal. */
export function FileDetails({ label, file }: { label: string; file: StoredFile }) {
  const { url } = file;
  const kind = fileKindFromExtension(file.extension) ?? "image";

  return (
    <section className="overflow-hidden rounded-xl ring-1 ring-slate-200">
      <h3 className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
        {label}
      </h3>
      <div className="p-4">
        {kind === "pdf" ? (
          <iframe
            src={url}
            title={`Preview of ${file.name}`}
            className="h-80 w-full rounded-lg bg-slate-100 ring-1 ring-slate-200 sm:h-96"
          />
        ) : (
          <FileThumbnail src={url} name={file.name} extension={file.extension} size="lg" />
        )}
        {kind === "model3d" && (
          <p className="mt-3 text-xs text-slate-500">
            3D files are stored as-is. Download the file to open it in a 3D viewer or modelling tool.
          </p>
        )}

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
          <div className="col-span-2">
            <dt className="text-xs text-slate-500">File name</dt>
            <dd className="mt-0.5 font-medium break-all text-slate-900">{file.name}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Type</dt>
            <dd className="mt-0.5 text-slate-900">
              {KIND_LABEL[kind]} · {file.extension.toUpperCase()}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Size</dt>
            <dd className="mt-0.5 text-slate-900">{formatBytes(file.size)}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-slate-500">MIME type</dt>
            <dd className="mt-0.5 font-mono text-xs break-all text-slate-700">{file.type}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-slate-500">Uploaded</dt>
            <dd className="mt-0.5 text-slate-900">{formatDateTime(file.uploadedAt)}</dd>
          </div>
        </dl>

        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={url}
            download={file.name}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-white px-2.5 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-300 ring-inset hover:bg-slate-50"
          >
            <DownloadIcon className="size-4" /> Download
          </a>
          {kind !== "model3d" && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-white px-2.5 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-300 ring-inset hover:bg-slate-50"
            >
              <ExternalIcon className="size-4" /> Open in new tab
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
