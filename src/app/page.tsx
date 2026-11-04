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
      <div className="h-11 w-full max-w-xs animate-pulse rounded-2xl bg-slate-200/70" />
      <div className="mt-6 overflow-hidden rounded-2xl bg-white shadow-[0_0_0_1px_rgb(15_23_42/0.08),0_2px_4px_rgb(15_23_42/0.06),0_8px_24px_rgb(15_23_42/0.10),0_20px_40px_-12px_rgb(15_23_42/0.20)]">
        <TableSkeleton />
      </div>
    </DashboardFrame>
  );
}
