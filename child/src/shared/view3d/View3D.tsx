import type { Section } from "@/shared/diagram";

/** Placeholder for the 3D view. A three.js scene for the section will render here. */
export function View3D({ section }: { section: Section }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="size-6" aria-hidden="true">
          <path d="M12 2.5 20.5 7v10L12 21.5 3.5 17V7L12 2.5Z" strokeLinejoin="round" />
          <path d="M3.5 7 12 11.5 20.5 7M12 11.5v10" strokeLinejoin="round" />
        </svg>
      </div>
      <h3 className="mt-4 text-sm font-semibold text-slate-900">3D view coming soon</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">A 3D model of {section.title} will render here.</p>
    </div>
  );
}
