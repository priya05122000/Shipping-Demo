import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRightIcon } from "@/components/ui/icons";

type Page = "projects" | "editor";

const NAV: { id: Page; href: string; label: string }[] = [
  { id: "projects", href: "/", label: "Projects" },
  { id: "editor", href: "/editor", label: "Editor" },
];

export type ProjectPage = "library" | "viewer" | "editor";

const PROJECT_NAV: { id: ProjectPage; path: string; label: string }[] = [
  { id: "library", path: "", label: "Library" },
  { id: "viewer", path: "/viewer", label: "Viewer" },
  { id: "editor", path: "/editor", label: "Editor" },
];

/** The ship a page belongs to, for the bar under the header. */
export interface FrameProject {
  /** Unset in loading fallbacks, before the URL is read. */
  id?: string;
  /** Unset while the ship is loading. */
  name?: string;
  /** Unset in loading fallbacks, before the URL is read. */
  current?: ProjectPage;
}

interface DashboardFrameProps {
  /** Which header link is highlighted. */
  current?: Page;
  /** On a ship's pages: its <ProjectBar> (breadcrumb and Library / Viewer / Editor links), under the header. */
  projectBar?: ReactNode;
  children: ReactNode;
}

/** Page chrome shared by the projects page, each ship's pages, the editor and their loading fallbacks. */
export function DashboardFrame({ current = "projects", projectBar, children }: DashboardFrameProps) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#0b1020]">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex size-9 items-center justify-center rounded-xl bg-linear-to-br from-indigo-400 via-indigo-500 to-violet-600 text-sm font-bold text-white shadow-lg ring-1 shadow-indigo-500/30 ring-white/20 ring-inset">
            S
          </div>
          <p className="text-[15px] font-semibold tracking-tight text-white">Ship Docs</p>
          <nav aria-label="Main" className="ml-auto flex gap-1 rounded-xl bg-white/5 p-1 ring-1 ring-white/10">
            {NAV.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                aria-current={item.id === current && !projectBar ? "page" : undefined}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-indigo-400 ${
                  item.id === current ? "bg-white text-slate-950 shadow-sm" : "text-slate-400 hover:bg-white/10 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        {projectBar}
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        {children}
      </main>
    </div>
  );
}

/** A ship's breadcrumb and its Library / Viewer / Editor links. `project={{}}` is its loading placeholder. */
export function ProjectBar({ project }: { project: FrameProject }) {
  const { id } = project;
  return (
    <div className="border-t border-white/[0.06]">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-2 sm:h-12 sm:flex-row sm:items-center sm:gap-6 sm:py-0 sm:px-6 lg:px-8">
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
          <Link href="/" className="shrink-0 text-slate-400 transition-colors hover:text-white">
            Projects
          </Link>
          <ChevronRightIcon className="size-4 shrink-0 text-slate-600" />
          {project.name === undefined ? (
            <span className="h-4 w-32 animate-pulse rounded bg-white/10" />
          ) : (
            <span className="truncate font-medium text-white" title={project.name}>
              {project.name}
            </span>
          )}
          {id && <span className="shrink-0 font-mono text-xs text-slate-500">{id}</span>}
        </nav>
        <nav aria-label="Ship" className="-mb-2 flex gap-1 sm:mb-0 sm:ml-auto sm:self-stretch">
          {PROJECT_NAV.map((item) => {
            const selected = item.id === project.current;
            const className = `flex items-center border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-400 sm:py-0 ${
              selected ? "border-indigo-400 text-white" : "border-transparent text-slate-400 hover:text-white"
            }`;
            return id ? (
              <Link
                key={item.id}
                href={`/projects/${encodeURIComponent(id)}${item.path}`}
                aria-current={selected ? "page" : undefined}
                className={className}
              >
                {item.label}
              </Link>
            ) : (
              <span key={item.id} className={className}>
                {item.label}
              </span>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
