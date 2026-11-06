import type { Metadata } from "next";
import { ProjectLibrary } from "./_components/ProjectLibrary";
import { ProjectWorkspace } from "./_components/ProjectWorkspace";

export const metadata: Metadata = {
  title: "Library · Ship Docs",
};

/** The ship's Library: its sections and objects. Framed by ./layout.tsx. */
export default function ProjectLibraryPage() {
  return (
    <ProjectWorkspace>
      <ProjectLibrary />
    </ProjectWorkspace>
  );
}
