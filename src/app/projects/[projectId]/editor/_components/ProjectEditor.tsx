"use client";

import { EditorWorkspace } from "@/components/editor/EditorWorkspace";
import { useProject } from "../../_components/ProjectWorkspace";

/** The editor, showing only the ship's folder. Inside ProjectWorkspace. */
export function ProjectEditor() {
  return <EditorWorkspace projectFolder={useProject().folder} />;
}
