"use client";

import Link from "next/link";
import { useParams, useSelectedLayoutSegment } from "next/navigation";
import { createContext, Suspense, useContext, type ReactNode } from "react";
import { ProjectBar, type ProjectPage } from "@/components/layout/DashboardFrame";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { AlertIcon, ArrowLeftIcon, ShipIcon } from "@/components/ui/icons";
import { useCollection } from "@/hooks/useCollection";
import { projectStore } from "@/lib/collections";
import type { Project } from "@/types/records";

const PANEL =
  "overflow-hidden rounded-2xl bg-white shadow-[0_0_0_1px_rgb(15_23_42/0.08),0_2px_4px_rgb(15_23_42/0.06),0_8px_24px_rgb(15_23_42/0.10),0_20px_40px_-12px_rgb(15_23_42/0.20)]";

const ProjectContext = createContext<Project | null>(null);

/** The ship whose page this is. Only inside ProjectWorkspace. */
export function useProject(): Project {
  const project = useContext(ProjectContext);
  if (!project) throw new Error("useProject() is only available inside <ProjectWorkspace>.");
  return project;
}

/** The ship's page each route segment under /projects/[projectId] is: none is the Library. */
const PAGES: Record<string, ProjectPage> = { viewer: "viewer", editor: "editor" };

/** Placeholder for a ship's page, while the URL is read and while the ship loads. */
function PageSkeleton() {
  return <div className="h-[calc(70vh+3.5rem)] min-h-134 animate-pulse rounded-2xl bg-slate-200/60" />;
}

/** The ship in the URL (/projects/[projectId]/…), from the ships list, which loads in the browser. */
function useProjectFromUrl() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data, error } = useCollection(projectStore);
  return { projectId, data, error, project: data?.items.find((item) => item.id === projectId) };
}

/**
 * The ship's breadcrumb and page links, in the header of its pages' shared layout. Reads the URL, so its loading
 * placeholder is a Suspense boundary around it (`<ProjectBar project={{}} />`).
 */
export function ProjectHeader() {
  const { projectId, project } = useProjectFromUrl();
  const segment = useSelectedLayoutSegment();
  const current = (segment && PAGES[segment]) || "library";
  return <ProjectBar project={{ id: projectId, name: project?.name, current }} />;
}

/**
 * Wraps the content of each of a ship's pages (Library, Viewer, Editor): renders it once the ship in the URL is found,
 * so it can read the ship with useProject(), and shows loading, error and not-found states until then.
 *
 * It's in each page rather than in their shared layout, so the layout always renders its page: Next's
 * instant-navigation check (Cache Components) can only check pages that are rendered on the server, where the ships
 * list hasn't loaded yet.
 */
export function ProjectWorkspace({ children }: { children: ReactNode }) {
  // Reading the URL needs a Suspense boundary when prerendered. It's here, inside the page, so it also covers
  // useSearchParams() in the pages, on page loads and on navigations between a ship's pages.
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ProjectGate>{children}</ProjectGate>
    </Suspense>
  );
}

function ProjectGate({ children }: { children: ReactNode }) {
  const { projectId, data, error, project } = useProjectFromUrl();

  if (project) {
    return (
      // Keyed, so moving to another ship starts its pages afresh (search, open dialogs, viewer).
      <ProjectContext key={project.id} value={project}>
        {children}
      </ProjectContext>
    );
  }
  if (!data && error) {
    return (
      <div className={PANEL}>
        <EmptyState
          icon={<AlertIcon className="size-6 text-red-500" />}
          title="Couldn't load this ship"
          description={error}
          action={
            <Button variant="secondary" onClick={() => void projectStore.reload()}>
              Try again
            </Button>
          }
        />
      </div>
    );
  }
  if (!data) return <PageSkeleton />;
  return (
    <div className={PANEL}>
      <EmptyState
        icon={<ShipIcon className="size-6" />}
        title={`${projectId} doesn't exist`}
        description="It may have been deleted, or the link is wrong."
        action={
          <Link
            href="/"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-medium text-slate-700 shadow-[0_0_0_1px_rgb(15_23_42/0.06),0_1px_2px_rgb(15_23_42/0.08)] hover:bg-slate-50 hover:text-slate-900"
          >
            <ArrowLeftIcon className="size-4" /> All projects
          </Link>
        }
      />
    </div>
  );
}
