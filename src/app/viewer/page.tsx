import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardFrame } from "@/components/dashboard/DashboardFrame";
import { ViewerHost } from "@/components/viewer/ViewerHost";

export const metadata: Metadata = {
  title: "Viewer · Ship Docs",
};

export default function ViewerPage() {
  // ViewerHost reads ?section= via useSearchParams, which needs a Suspense boundary when prerendered.
  return (
    <DashboardFrame current="viewer">
      <Suspense fallback={<div className="h-[calc(70vh+3.75rem)] min-h-135 animate-pulse rounded-xl bg-slate-200/60" />}>
        <ViewerHost />
      </Suspense>
    </DashboardFrame>
  );
}
