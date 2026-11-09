"use client";

import { useState } from "react";
import { ChevronRightIcon, FileIcon, FolderIcon } from "@/components/ui/icons";
import { isBinaryName, type ChildEntry } from "@/lib/child-files";

interface FileTreeProps {
  entries: ChildEntry[];
  activePath: string | null;
  /** Files with unsaved changes. */
  dirtyPaths: ReadonlySet<string>;
  /** Folders that start open, besides the one holding the active file. */
  openByDefault: readonly string[];
  onOpen: (path: string) => void;
}

const ROW =
  "flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left text-[13px] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-600";

/** The child app's files. A folder starts open if it's in `openByDefault` or holds the active file; clicking it overrides that. */
export function FileTree({ entries, activePath, dirtyPaths, openByDefault, onOpen }: FileTreeProps) {
  const [toggled, setToggled] = useState<Record<string, boolean>>({});

  const isOpen = (folder: string) =>
    toggled[folder] ?? (openByDefault.includes(folder) || Boolean(activePath?.startsWith(`${folder}/`)));

  function renderList(list: ChildEntry[], depth: number) {
    const indent = { paddingLeft: `${depth * 0.75 + 0.5}rem` };
    return (
      <ul>
        {list.map((entry) => {
          if (entry.type === "folder") {
            const open = isOpen(entry.path);
            return (
              <li key={entry.path}>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setToggled((current) => ({ ...current, [entry.path]: !open }))}
                  className={`${ROW} text-slate-700 hover:bg-slate-200/60`}
                  style={indent}
                >
                  <ChevronRightIcon
                    className={`size-3.5 shrink-0 text-slate-400 transition-transform ${open ? "rotate-90" : ""}`}
                  />
                  <FolderIcon className="size-4 shrink-0 text-indigo-400" />
                  <span className="truncate">{entry.name}</span>
                </button>
                {open && renderList(entry.children, depth + 1)}
              </li>
            );
          }
          const active = entry.path === activePath;
          const binary = isBinaryName(entry.name);
          return (
            <li key={entry.path}>
              <button
                type="button"
                aria-current={active ? "true" : undefined}
                onClick={() => onOpen(entry.path)}
                title={binary ? `${entry.path} (binary, can't be edited)` : entry.path}
                className={`${ROW} ${
                  active
                    ? "bg-indigo-50 font-medium text-indigo-700"
                    : binary
                      ? "text-slate-400 hover:bg-slate-200/60"
                      : "text-slate-700 hover:bg-slate-200/60"
                }`}
                style={indent}
              >
                {/* Lines files up with folder names, past the folders' chevrons. */}
                <span className="size-3.5 shrink-0" />
                <FileIcon className={`size-4 shrink-0 ${active ? "text-indigo-500" : "text-slate-400"}`} />
                <span className="truncate">{entry.name}</span>
                {dirtyPaths.has(entry.path) && (
                  <>
                    <span className="ml-auto size-2 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
                    <span className="sr-only">(unsaved changes)</span>
                  </>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    );
  }

  return renderList(entries, 0);
}
