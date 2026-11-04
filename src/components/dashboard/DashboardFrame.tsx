import Link from "next/link";
import type { ReactNode } from "react";

type Page = "library" | "viewer" | "editor";

const NAV: { id: Page; href: string; label: string }[] = [
  { id: "library", href: "/", label: "Library" },
  { id: "viewer", href: "/viewer", label: "Viewer" },
  { id: "editor", href: "/editor", label: "Editor" },
];

interface DashboardFrameProps {
  /** Which header link is highlighted. */
  current?: Page;
  children: ReactNode;
}

/** Page chrome shared by the dashboard, the viewer, the editor and their loading fallbacks. */
export function DashboardFrame({
  current = "library",
  children,
}: DashboardFrameProps) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#0b1020]">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex size-9 items-center justify-center rounded-xl bg-linear-to-br from-indigo-400 via-indigo-500 to-violet-600 text-sm font-bold text-white shadow-lg ring-1 shadow-indigo-500/30 ring-white/20 ring-inset">
            S
          </div>
          <p className="text-[15px] font-semibold tracking-tight text-white">Ship Docs</p>
          <nav aria-label="Main" className="ml-auto flex gap-1 rounded-xl bg-white/5 p-1 ring-1 ring-white/10">
            {NAV.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                aria-current={item.id === current ? "page" : undefined}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-indigo-400 ${
                  item.id === current ? "bg-white text-slate-950 shadow-sm" : "text-slate-400 hover:bg-white/10 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        {children}
      </main>
    </div>
  );
}
