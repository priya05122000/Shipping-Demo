import type { Metadata } from "next";
import { ViewerHost } from "./_components/ViewerHost";

export const metadata: Metadata = {
  title: "Viewer · Ship Docs",
};

/** The ship's own viewer project, embedded. Framed by ../layout.tsx. */
export default function ProjectViewerPage() {
  return <ViewerHost />;
}
