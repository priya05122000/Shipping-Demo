import type { Metadata } from "next";
import { ProjectEditor } from "./_components/ProjectEditor";

export const metadata: Metadata = {
  title: "Editor · Ship Docs",
};

/** The editor for the ship's project folder. Framed by ../layout.tsx. */
export default function ProjectEditorPage() {
  return <ProjectEditor />;
}
