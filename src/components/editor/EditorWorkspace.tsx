"use client";

import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { editor } from "monaco-editor";
import { CodeEditor } from "@/components/editor/CodeEditor";
import { FileTree } from "@/components/editor/FileTree";
import { NewFileModal } from "@/components/editor/NewFileModal";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { AlertIcon, FileIcon, PlusIcon, TrashIcon, XIcon } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/Spinner";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { isBinaryName, type ChildEntry, type ChildFile } from "@/lib/child-files";
import { childFiles } from "@/lib/child-files-api";
import { loadMonaco, type Monaco } from "@/lib/monaco";
import { RequestError } from "@/lib/request";

interface OpenFile {
  path: string;
  status: "loading" | "ready" | "error";
  /** Why the file couldn't be opened. */
  error?: string;
  model?: editor.ITextModel;
  /** Version on disk when the file was last loaded or saved. Saves send it, so the server can spot outside changes. */
  version?: string;
  /** The model's alternative version ID at that point. When it matches again (e.g. after undo) there's nothing to save. */
  savedAt?: number;
  dirty: boolean;
  saving: boolean;
  /** The last save was refused because the file changed on disk since it was opened. */
  conflict: boolean;
}

type Dialog = { type: "new" } | { type: "delete" | "discard"; path: string } | null;

const baseName = (path: string) => path.slice(path.lastIndexOf("/") + 1);
const folderOf = (path: string) => path.slice(0, path.lastIndexOf("/") + 1);
const messageOf = (error: unknown) => (error instanceof Error ? error.message : "Something went wrong.");
const isDirty = (file: OpenFile) => Boolean(file.model) && file.model?.getAlternativeVersionId() !== file.savedAt;

function hasFile(entries: ChildEntry[], path: string): boolean {
  return entries.some((entry) => (entry.type === "file" ? entry.path === path : hasFile(entry.children, path)));
}

/** The file's model, reusing one left over from an earlier visit to the page (Monaco keeps models globally). */
function modelFor(monaco: Monaco, file: ChildFile) {
  const uri = monaco.Uri.file(file.path);
  const existing = monaco.editor.getModel(uri);
  if (!existing) return monaco.editor.createModel(file.content, undefined, uri);
  existing.setValue(file.content);
  return existing;
}

interface EditorWorkspaceProps {
  /**
   * A ship's project folder name, e.g. "mv-aurora": the editor shows and edits only child/ships/mv-aurora, with paths
   * like "mv-aurora/src/main.tsx". Without it, the editor shows the shared files: everything in ./child but the ships,
   * with paths like "template/src/main.tsx".
   */
  projectFolder?: string;
}

/** File tree, open-file tabs and a Monaco editor for the child app's source. The server refuses paths outside its scope. */
export function EditorWorkspace({ projectFolder }: EditorWorkspaceProps) {
  return (
    <ToastProvider>
      <Workspace projectFolder={projectFolder} />
    </ToastProvider>
  );
}

function Workspace({ projectFolder }: EditorWorkspaceProps) {
  const scope = projectFolder ?? null;
  const api = useMemo(() => childFiles(scope), [scope]);
  const toast = useToast();
  const searchParams = useSearchParams();
  const [entries, setEntries] = useState<ChildEntry[] | null>(null);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [files, setFiles] = useState<OpenFile[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [deleting, setDeleting] = useState(false);
  // Paths with a save in flight. A ref, so a quick second Ctrl+S can't send the same save twice.
  const savingRef = useRef(new Set<string>());
  // The ?file= link is opened once, on the first successful load of the tree.
  const restoredRef = useRef(false);

  const active = files.find((file) => file.path === activePath) ?? null;
  // A ship's src starts open; in the shared files, the template does.
  const openByDefault = useMemo(() => (scope === null ? ["template"] : [`${scope}/src`]), [scope]);
  const dirtyPaths = useMemo(() => new Set(files.filter((file) => file.dirty).map((file) => file.path)), [files]);
  const hasUnsaved = dirtyPaths.size > 0;

  function updateFile(path: string, change: (file: OpenFile) => OpenFile) {
    setFiles((current) => current.map((file) => (file.path === path ? change(file) : file)));
  }

  /** After each edit. Keeps the same state when no file's dirty flag flips, so typing doesn't re-render. */
  function refreshDirty() {
    setFiles((current) =>
      current.some((file) => isDirty(file) !== file.dirty)
        ? current.map((file) => ({ ...file, dirty: isDirty(file) }))
        : current,
    );
  }

  function showFile(path: string | null) {
    setActivePath(path);
    // Native history updates sync with useSearchParams without a server round trip.
    const params = new URLSearchParams(searchParams.toString());
    if (path) params.set("file", path);
    else params.delete("file");
    const query = params.toString();
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
  }

  const loadTree = useCallback(async () => {
    try {
      const list = await api.list();
      setEntries(list);
      setTreeError(null);
      return list;
    } catch (error) {
      setTreeError(messageOf(error));
      return null;
    }
  }, [api]);

  async function openFile(path: string) {
    showFile(path);
    if (files.some((file) => file.path === path)) return;
    const opened: OpenFile = { path, status: "loading", dirty: false, saving: false, conflict: false };
    if (isBinaryName(path)) {
      opened.status = "error";
      opened.error = "This is a binary file. The editor only opens text files.";
    }
    setFiles((current) => (current.some((file) => file.path === path) ? current : [...current, opened]));
    if (opened.status === "error") return;
    try {
      const [monaco, file] = await Promise.all([loadMonaco(), api.read(path)]);
      const model = modelFor(monaco, file);
      const savedAt = model.getAlternativeVersionId();
      updateFile(path, (f) => ({ ...f, status: "ready", model, version: file.version, savedAt, dirty: false }));
    } catch (error) {
      updateFile(path, (f) => ({ ...f, status: "error", error: messageOf(error) }));
    }
  }

  /** Closes a tab without asking. */
  function dropFile(path: string) {
    const index = files.findIndex((file) => file.path === path);
    if (index === -1) return;
    files[index].model?.dispose();
    const rest = files.filter((file) => file.path !== path);
    setFiles((current) => current.filter((file) => file.path !== path));
    // Like most editors, move to the tab that took its place, or the one before it.
    if (path === activePath) showFile(rest[Math.min(index, rest.length - 1)]?.path ?? null);
  }

  function closeFile(path: string) {
    const file = files.find((f) => f.path === path);
    if (file && isDirty(file)) setDialog({ type: "discard", path });
    else dropFile(path);
  }

  /** `baseVersion` overrides the version the file was opened at (used to overwrite after a conflict). */
  async function save(path: string, baseVersion?: string) {
    const file = files.find((f) => f.path === path);
    const version = baseVersion ?? file?.version;
    // isDirty() asks the model, so a keystroke right before Ctrl+S counts even if its re-render hasn't happened yet.
    if (!file?.model || !isDirty(file) || !version || savingRef.current.has(path)) return;
    // Close the current undo step, so typing after the save can be undone back to exactly the saved text.
    file.model.pushStackElement();
    const savedAt = file.model.getAlternativeVersionId();
    // Keeps the file's line endings, and its byte-order mark if it had one.
    const content = file.model.getValue(undefined, true);
    savingRef.current.add(path);
    updateFile(path, (f) => ({ ...f, saving: true }));
    try {
      const result = await api.save(path, content, version);
      // Edits made while the save was in flight stay unsaved.
      updateFile(path, (f) => ({ ...f, version: result.version, savedAt, dirty: isDirty({ ...f, savedAt }), conflict: false }));
    } catch (error) {
      if (error instanceof RequestError && error.status === 409) updateFile(path, (f) => ({ ...f, conflict: true }));
      else toast.error(`Couldn't save ${baseName(path)}`, messageOf(error));
    } finally {
      savingRef.current.delete(path);
      updateFile(path, (f) => ({ ...f, saving: false }));
    }
  }

  /** After a conflict: replace the editor's text with the file on disk. Undo brings the user's version back. */
  async function loadFromDisk(path: string) {
    const model = files.find((f) => f.path === path)?.model;
    if (!model) return;
    try {
      const file = await api.read(path);
      model.pushStackElement();
      // The model already knows whether the file has a byte-order mark; don't insert it as text.
      model.pushEditOperations([], [{ range: model.getFullModelRange(), text: file.content.replace(/^﻿/, "") }], () => null);
      model.pushStackElement();
      const savedAt = model.getAlternativeVersionId();
      updateFile(path, (f) => ({ ...f, version: file.version, savedAt, dirty: false, conflict: false }));
    } catch (error) {
      toast.error(`Couldn't load ${baseName(path)}`, messageOf(error));
    }
  }

  /** After a conflict: save the editor's text over whatever is on disk now. */
  async function overwrite(path: string) {
    try {
      const { version } = await api.read(path);
      await save(path, version);
    } catch (error) {
      toast.error(`Couldn't save ${baseName(path)}`, messageOf(error));
    }
  }

  async function handleDelete(path: string) {
    if (deleting) return;
    setDeleting(true);
    try {
      await api.remove(path);
      setDialog(null);
      dropFile(path);
      toast.success("File deleted", path);
      void loadTree();
    } catch (error) {
      toast.error(`Couldn't delete ${baseName(path)}`, messageOf(error));
    } finally {
      setDeleting(false);
    }
  }

  function handleCreated(file: ChildFile) {
    setDialog(null);
    toast.success("File created", file.path);
    void loadTree();
    void openFile(file.path);
  }

  const restoreFromUrl = useEffectEvent((list: ChildEntry[]) => {
    const wanted = searchParams.get("file");
    if (wanted && hasFile(list, wanted)) void openFile(wanted);
  });

  useEffect(() => {
    void loadTree().then((list) => {
      if (!list || restoredRef.current) return;
      restoredRef.current = true;
      restoreFromUrl(list);
    });
    // Pick up files added or removed elsewhere (e.g. in an IDE) when the user comes back to this tab.
    const onFocus = () => void loadTree();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadTree]);

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== "s") return;
    // Ctrl/Cmd+S saves the open file instead of the browser's "Save page".
    event.preventDefault();
    if (activePath) void save(activePath);
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKeyDown(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  useEffect(() => {
    if (!hasUnsaved) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsaved]);

  const activeName = active ? baseName(active.path) : "";

  return (
    <section aria-label="Code editor" className="overflow-hidden rounded-2xl bg-white shadow-[0_0_0_1px_rgb(15_23_42/0.08),0_2px_4px_rgb(15_23_42/0.06),0_8px_24px_rgb(15_23_42/0.10),0_20px_40px_-12px_rgb(15_23_42/0.20)]">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-6">
        <p className="flex min-w-0 flex-1 items-center gap-2 text-sm text-slate-500">
          {active ? (
            <span className="truncate font-mono text-slate-900" title={active.path}>
              {active.path}
            </span>
          ) : (
            "No file open"
          )}
          {active?.dirty && (
            <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200 ring-inset">
              Unsaved
            </span>
          )}
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setDialog({ type: "new" })} disabled={!entries}>
            <PlusIcon className="size-4" /> New file
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => active && setDialog({ type: "delete", path: active.path })}
            disabled={!active || active.status === "loading"}
          >
            <TrashIcon className="size-4" /> Delete
          </Button>
          <Button
            size="sm"
            onClick={() => active && void save(active.path)}
            disabled={!active?.dirty}
            loading={active?.saving}
            title="Save (Ctrl+S)"
          >
            {active?.saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <div className="grid h-[70vh] min-h-120 grid-rows-[minmax(0,10rem)_minmax(0,1fr)] sm:grid-cols-[16rem_minmax(0,1fr)] sm:grid-rows-1">
        <nav
          aria-label={scope === null ? "Shared files" : "Ship files"}
          className="min-h-0 overflow-auto border-b border-slate-200 bg-slate-50/60 p-2 sm:border-r sm:border-b-0"
        >
          {entries ? (
            entries.length > 0 ? (
              <FileTree
                entries={entries}
                activePath={activePath}
                dirtyPaths={dirtyPaths}
                openByDefault={openByDefault}
                onOpen={(path) => void openFile(path)}
              />
            ) : (
              <p className="px-2 py-1 text-sm text-slate-500">
                {scope === null ? "The child folder has no shared files." : "This ship's folder is empty."}
              </p>
            )
          ) : treeError ? (
            <div role="alert" className="space-y-3 px-2 py-1 text-sm">
              <p className="text-red-600">{treeError}</p>
              <Button variant="secondary" size="sm" onClick={() => void loadTree()}>
                Try again
              </Button>
            </div>
          ) : (
            <p className="flex items-center gap-2 px-2 py-1 text-sm text-slate-500">
              <Spinner className="size-4" /> Loading files…
            </p>
          )}
        </nav>

        <div className="flex min-h-0 min-w-0 flex-col">
          {files.length > 0 && (
            <div className="flex shrink-0 overflow-x-auto border-b border-slate-200 bg-slate-50">
              {files.map((file) => {
                const selected = file.path === activePath;
                const name = baseName(file.path);
                return (
                  <div
                    key={file.path}
                    className={`flex shrink-0 items-center border-r border-slate-200 ${
                      selected ? "bg-white shadow-[inset_0_2px_0_var(--color-indigo-500)]" : "hover:bg-white/60"
                    }`}
                  >
                    <button
                      type="button"
                      aria-current={selected ? "true" : undefined}
                      onClick={() => showFile(file.path)}
                      title={file.path}
                      className={`flex items-center gap-1.5 py-2 pr-1 pl-3 text-[13px] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-600 ${
                        selected ? "font-medium text-slate-900" : "text-slate-500"
                      }`}
                    >
                      {name}
                      {file.dirty && (
                        <>
                          <span className="size-2 rounded-full bg-amber-500" aria-hidden="true" />
                          <span className="sr-only">(unsaved changes)</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => closeFile(file.path)}
                      aria-label={`Close ${name}`}
                      className="mr-1.5 rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-indigo-600"
                    >
                      <XIcon className="size-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {active?.conflict && (
            <div
              role="alert"
              className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800"
            >
              <AlertIcon className="size-4 shrink-0" />
              <p className="min-w-0 flex-1">{activeName} changed on disk since you opened it, so it wasn&apos;t saved.</p>
              <Button variant="secondary" size="sm" onClick={() => void loadFromDisk(active.path)}>
                Load disk version
              </Button>
              <Button variant="secondary" size="sm" onClick={() => void overwrite(active.path)} loading={active.saving}>
                Overwrite with mine
              </Button>
            </div>
          )}

          <div className="relative min-h-0 flex-1">
            <CodeEditor model={active?.status === "ready" ? (active.model ?? null) : null} onChange={refreshDirty} />
            {active?.status !== "ready" && (
              <div className="absolute inset-0 flex items-center justify-center bg-white">
                {!active ? (
                  <EmptyState
                    icon={<FileIcon className="size-6" />}
                    title="No file open"
                    description="Pick a file of the child app from the list, or create a new one."
                  />
                ) : active.status === "loading" ? (
                  <p className="flex items-center gap-2 text-sm text-slate-500">
                    <Spinner className="size-4" /> Opening {activeName}…
                  </p>
                ) : (
                  <EmptyState
                    icon={<AlertIcon className="size-6 text-red-500" />}
                    title={`Can't open ${activeName}`}
                    description={active.error ?? "Something went wrong."}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {dialog?.type === "new" && (
        <NewFileModal
          scope={scope}
          folder={active ? folderOf(active.path) : scope === null ? "template/src/" : `${scope}/src/`}
          onClose={() => setDialog(null)}
          onCreated={handleCreated}
        />
      )}
      <ConfirmDialog
        open={dialog?.type === "delete"}
        title="Delete file?"
        message={
          dialog?.type === "delete" && (
            <>
              <span className="font-mono font-medium text-slate-900">{dialog.path}</span> will be permanently deleted
              from the child app. This can&apos;t be undone.
            </>
          )
        }
        busy={deleting}
        onConfirm={() => dialog?.type === "delete" && void handleDelete(dialog.path)}
        onCancel={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog?.type === "discard"}
        title="Discard unsaved changes?"
        message={
          dialog?.type === "discard" && (
            <>
              Your changes to <span className="font-mono font-medium text-slate-900">{dialog.path}</span> will be lost.
            </>
          )
        }
        confirmLabel="Discard changes"
        onConfirm={() => {
          if (dialog?.type === "discard") dropFile(dialog.path);
          setDialog(null);
        }}
        onCancel={() => setDialog(null)}
      />
    </section>
  );
}
