import type { ReactNode } from "react";

interface SectionLayoutProps {
  title: string;
  /** The line under the title. */
  summary: string;
  /** On the right of the toolbar, before the controls: e.g. a piping diagram's legend. */
  legend?: ReactNode;
  /** The ship's actions and the view switcher. */
  controls: ReactNode;
  /** After the controls: e.g. a piping diagram's Values and Tags switches and its alarm count. */
  extra?: ReactNode;
  /** The section's view, in a <main>. */
  children: ReactNode;
}

/** One section: its toolbar across the top, then its view. */
export function SectionLayout({ title, summary, legend, controls, extra, children }: SectionLayoutProps) {
  return (
    <div className="grid min-h-0 min-w-0 grid-rows-[auto_1fr] max-wide:overflow-y-auto">
      <header data-ui="section-toolbar" className="flex flex-wrap items-center gap-x-5 gap-y-2.5 border-b border-line bg-panel px-4.5 py-2.5">
        <div className="min-w-0">
          <h1 data-ui="section-title" className="text-[17px] font-[650] tracking-[0.2px] text-heading">
            {title}
          </h1>
          <p data-ui="section-summary" className="mt-0.5 text-[12px] text-muted">
            {summary}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-2.5">
          {legend}
          {controls}
          {extra}
        </div>
      </header>
      {children}
    </div>
  );
}
