"use client";

import Link from "next/link";
import { useParams, useSelectedLayoutSegment } from "next/navigation";
import { createContext, useContext, type ReactNode } from "react";
import { DashboardFrame, type ProjectPage } from "@/components/layout/DashboardFrame";
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
export function PageSkeleton() {
  return <div className="h-[calc(70vh+3.5rem)] min-h-134 animate-pulse rounded-2xl bg-slate-200/60" />;
}

/**
 * Frame for the pages of the ship in the URL (/projects/[projectId]/…), rendered by their layout. The page is only
 * rendered once the ship is found, and can read it with useProject(). Reads the URL, so it must be inside a Suspense
 * boundary.
 */
export function ProjectWorkspace({ children }: { children: ReactNode }) {
  const { projectId } = useParams<{ projectId: string }>();
  const segment = useSelectedLayoutSegment();
  const current = (segment && PAGES[segment]) || "library";
  const { data, error } = useCollection(projectStore);
  const project = data?.items.find((item) => item.id === projectId);

  return (
    <DashboardFrame project={{ id: projectId, name: project?.name, current }}>
      {project ? (
        // Keyed, so moving to another ship starts its pages afresh (search, open dialogs, viewer).
        <ProjectContext key={project.id} value={project}>
          {children}
        </ProjectContext>
      ) : !data && error ? (
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
      ) : !data ? (
        <PageSkeleton />
      ) : (
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
      )}
    </DashboardFrame>
  );
}
