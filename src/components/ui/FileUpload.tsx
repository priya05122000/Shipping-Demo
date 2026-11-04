"use client";

import { useId, useRef, useState, type DragEvent, type ReactNode } from "react";
import { FileThumbnail } from "@/components/files/FileThumbnail";
import { Button } from "@/components/ui/Button";
import { UploadIcon } from "@/components/ui/icons";
import { useObjectUrl } from "@/hooks/useObjectUrl";
import { acceptAttribute, formatBytes, getExtension, validateFile, type FileRule } from "@/lib/files";
import type { StoredFile } from "@/types/records";

interface FileUploadProps {
  label: string;
  rule: FileRule;
  required?: boolean;
  /** Newly selected file (not yet saved). */
  file: File | null;
  /** File already saved on the record being edited; kept when no replacement is chosen. */
  existing?: StoredFile | null;
  onFileChange: (file: File | null) => void;
  /** Error from the parent form, e.g. "required". */
  error?: string | null;
  disabled?: boolean;
  /** The existing file is marked to be removed on save. */
  removed?: boolean;
  /** Offers removing the existing file (for optional files). Picking a new file should clear `removed`. */
  onRemovedChange?: (removed: boolean) => void;
}

export function FileUpload({
  label,
  rule,
  required,
  file,
  existing,
  onFileChange,
  error,
  disabled,
  removed = false,
  onRemovedChange,
}: FileUploadProps) {
  const inputId = useId();
  const messageId = `${inputId}-message`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectError, setSelectError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const previewUrl = useObjectUrl(file);

  function accept(candidate: File | undefined) {
    if (!candidate) return;
    const problem = validateFile(candidate, rule);
    setSelectError(problem);
    if (!problem) onFileChange(candidate);
  }

  function openPicker() {
    inputRef.current?.click();
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    if (!disabled) accept(event.dataTransfer.files[0]);
  }

  const message = selectError ?? error;
  const hint = `${rule.label} · max ${formatBytes(rule.maxSize)}`;

  return (
    <div>
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={acceptAttribute(rule)}
        className="sr-only"
        disabled={disabled}
        aria-invalid={message ? true : undefined}
        aria-describedby={messageId}
        onChange={(event) => {
          accept(event.target.files?.[0]);
          // Allow re-selecting the same file after an error or removal.
          event.target.value = "";
        }}
      />

      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`rounded-xl transition-colors ${dragging ? "bg-indigo-50 ring-2 ring-indigo-500" : ""}`}
      >
        {file ? (
          <FileCard
            thumbnail={<FileThumbnail src={previewUrl} name={file.name} extension={getExtension(file.name)} />}
            name={file.name}
            extension={getExtension(file.name)}
            size={file.size}
            badge={existing && !removed ? "Replacement" : "Selected"}
            badgeClass="bg-indigo-50 text-indigo-700 ring-indigo-200"
            actions={
              <>
                <Button size="sm" variant="secondary" onClick={openPicker} disabled={disabled}>
                  Change
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSelectError(null);
                    onFileChange(null);
                  }}
                  disabled={disabled}
                >
                  {existing && !removed ? "Keep current" : "Remove"}
                </Button>
              </>
            }
          />
        ) : existing && removed ? (
          <FileCard
            thumbnail={
              <div className="opacity-40">
                <FileThumbnail src={existing.url} name={existing.name} extension={existing.extension} />
              </div>
            }
            name={existing.name}
            extension={existing.extension}
            size={existing.size}
            badge="Will be removed"
            badgeClass="bg-red-50 text-red-700 ring-red-200"
            actions={
              <>
                <Button size="sm" variant="secondary" onClick={openPicker} disabled={disabled}>
                  <UploadIcon className="size-4" /> Upload new
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onRemovedChange?.(false)} disabled={disabled}>
                  Undo
                </Button>
              </>
            }
          />
        ) : existing ? (
          <FileCard
            thumbnail={<FileThumbnail src={existing.url} name={existing.name} extension={existing.extension} />}
            name={existing.name}
            extension={existing.extension}
            size={existing.size}
            badge="Current file"
            badgeClass="bg-emerald-50 text-emerald-700 ring-emerald-200"
            actions={
              <>
                <Button size="sm" variant="secondary" onClick={openPicker} disabled={disabled}>
                  <UploadIcon className="size-4" /> Replace
                </Button>
                {onRemovedChange && (
                  <Button size="sm" variant="ghost" onClick={() => onRemovedChange(true)} disabled={disabled}>
                    Remove
                  </Button>
                )}
              </>
            }
          />
        ) : (
          <button
            type="button"
            onClick={openPicker}
            disabled={disabled}
            className={`group flex w-full flex-col items-center rounded-2xl border border-dashed px-4 py-7 text-center transition-all hover:border-indigo-400 hover:bg-linear-to-b hover:from-indigo-50/60 hover:to-violet-50/30 focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-60 ${
              message ? "border-red-300 bg-red-50/40" : "border-slate-300 bg-slate-50/50"
            }`}
          >
            <span className="flex size-11 items-center justify-center rounded-xl bg-white text-slate-500 shadow-[0_0_0_1px_rgb(15_23_42/0.06),0_1px_2px_rgb(15_23_42/0.08)] transition-colors group-hover:text-indigo-600">
              <UploadIcon className="size-5" />
            </span>
            <span className="mt-3 text-sm font-semibold text-indigo-600">Click to upload</span>
            <span className="text-sm text-slate-500"> or drag and drop</span>
            <span className="mt-1 text-xs text-slate-400">{hint}</span>
          </button>
        )}
      </div>

      <p id={messageId} className={`mt-1.5 text-xs ${message ? "text-red-600" : "text-slate-500"}`} role={message ? "alert" : undefined}>
        {message ?? (file || existing ? hint : null)}
      </p>
    </div>
  );
}

function FileCard({
  thumbnail,
  name,
  extension,
  size,
  badge,
  badgeClass,
  actions,
}: {
  thumbnail: ReactNode;
  name: string;
  extension: string;
  size: number;
  badge: string;
  badgeClass: string;
  actions: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-white p-3 shadow-[0_0_0_1px_rgb(15_23_42/0.06),0_1px_2px_rgb(15_23_42/0.08)] sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {thumbnail}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-900" title={name}>
            {name}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600 uppercase">{extension}</span>
            <span>{formatBytes(size)}</span>
            <span className={`rounded-full px-2 py-0.5 font-medium ring-1 ring-inset ${badgeClass}`}>{badge}</span>
          </p>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">{actions}</div>
    </div>
  );
}
