import { Suspense } from "react";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { DashboardFrame } from "@/components/dashboard/DashboardFrame";
import { TableSkeleton } from "@/components/records/RecordTable";

export default function Home() {
  // Dashboard reads ?tab= via useSearchParams, which needs a Suspense boundary when prerendered.
  return (
    <Suspense fallback={<DashboardFallback />}>
      <Dashboard />
    </Suspense>
  );
}

function DashboardFallback() {
  return (
    <DashboardFrame>
      <div className="h-11 w-full max-w-md animate-pulse rounded-xl bg-slate-200/60" />
      <div className="mt-6 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <TableSkeleton />
      </div>
    </DashboardFrame>
  );
}
