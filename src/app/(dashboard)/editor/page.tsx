import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardFrame } from "@/components/layout/DashboardFrame";
import { EditorWorkspace } from "@/components/editor/EditorWorkspace";

export const metadata: Metadata = {
  title: "Editor · Ship Docs",
};

export default function EditorPage() {
  // EditorWorkspace reads ?file= via useSearchParams, which needs a Suspense boundary when prerendered.
  return (
    <DashboardFrame current="editor">
      <Suspense fallback={<div className="h-[calc(70vh+3.5rem)] min-h-134 animate-pulse rounded-xl bg-slate-200/60" />}>
        <EditorWorkspace />
      </Suspense>
    </DashboardFrame>
  );
}
