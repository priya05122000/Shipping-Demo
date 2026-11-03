import type { ReactNode } from "react";

/** Page chrome shared by the dashboard and its loading fallback. */
export function DashboardFrame({ meter, children }: { meter?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex size-9 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">S</div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Ship Docs</p>
            <p className="text-xs text-slate-500">Document &amp; diagram management</p>
          </div>
          <span className="ml-auto hidden rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200 ring-inset sm:inline">
            Local mode · no cloud
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Library</h1>
            <p className="mt-1 text-sm text-slate-500">Manage line diagrams, 3D objects and manuals.</p>
          </div>
          {meter}
        </div>
        {children}
      </main>
    </div>
  );
}
