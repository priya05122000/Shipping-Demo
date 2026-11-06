import { Suspense } from "react";
import { DashboardFrame } from "@/components/layout/DashboardFrame";
import { PageSkeleton, ProjectWorkspace } from "./_components/ProjectWorkspace";

/**
 * A ship's pages (Library, Viewer, Editor) share this frame: the header with the ship's breadcrumb and page links,
 * which stays mounted while moving between them. Reading the ship's ID from the URL needs a Suspense boundary when
 * prerendered.
 */
export default function ProjectLayout({ children }: LayoutProps<"/projects/[projectId]">) {
  return (
    <Suspense
      fallback={
        <DashboardFrame project={{}}>
          <PageSkeleton />
        </DashboardFrame>
      }
    >
      <ProjectWorkspace>{children}</ProjectWorkspace>
    </Suspense>
  );
}
