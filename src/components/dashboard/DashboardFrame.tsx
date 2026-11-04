import Link from "next/link";
import type { ReactNode } from "react";

type Page = "library" | "viewer";

const NAV: { id: Page; href: string; label: string }[] = [
  { id: "library", href: "/", label: "Library" },
  { id: "viewer", href: "/viewer", label: "Viewer" },
];

interface DashboardFrameProps {
  /** Which header link is highlighted. */
  current?: Page;
  title?: string;
  description?: string;
  meter?: ReactNode;
  children: ReactNode;
}

/** Page chrome shared by the dashboard, the viewer and their loading fallbacks. */
export function DashboardFrame({
  current = "library",
  title = "Library",
  description = "Manage line diagrams, 3D objects and manuals.",
  meter,
  children,
}: DashboardFrameProps) {
  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex size-9 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">S</div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Ship Docs</p>
            {/* Hidden on phones so the nav fits beside the name. */}
            <p className="hidden text-xs text-slate-500 sm:block">Document &amp; diagram management</p>
          </div>
          <nav aria-label="Main" className="ml-4 flex gap-1 sm:ml-6">
            {NAV.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                aria-current={item.id === current ? "page" : undefined}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-indigo-600 ${
                  item.id === current ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <span className="ml-auto hidden rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200 ring-inset sm:inline">
            Local mode · no cloud
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>
          {meter}
        </div>
        {children}
      </main>
    </div>
  );
}
