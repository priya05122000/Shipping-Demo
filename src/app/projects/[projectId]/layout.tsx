import { Suspense } from "react";
import { DashboardFrame, ProjectBar } from "@/components/layout/DashboardFrame";
import { ProjectHeader } from "./_components/ProjectWorkspace";

/**
 * A ship's pages (Library, Viewer, Editor) share this frame: the header with the ship's breadcrumb and page links,
 * which stays mounted while moving between them. The breadcrumb reads the ship's ID from the URL, which needs a
 * Suspense boundary when prerendered. The page is always rendered: each page finds the ship itself, through
 * <ProjectWorkspace> (see there for why).
 */
export default function ProjectLayout({ children }: LayoutProps<"/projects/[projectId]">) {
  return (
    <DashboardFrame
      projectBar={
        <Suspense fallback={<ProjectBar project={{}} />}>
          <ProjectHeader />
        </Suspense>
      }
    >
      {children}
    </DashboardFrame>
  );
}
