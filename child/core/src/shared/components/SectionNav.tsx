import type { Section } from "../diagram";
import { DiagramIcon } from "../ui";

interface SectionNavProps {
  sections: Section[];
  activeId: string;
  onSelect: (sectionId: string) => void;
}

/** List of drawings: a row on small screens, a column beside the diagram on wider ones. */
export function SectionNav({ sections, activeId, onSelect }: SectionNavProps) {
  return (
    <nav aria-label="Drawings" data-ui="section-nav">
      <p data-ui="section-nav-heading" className="mb-2 hidden px-2 text-xs font-medium tracking-wide text-slate-500 uppercase md:block">Drawings</p>
      <ul className="flex gap-1 overflow-x-auto md:flex-col">
        {sections.map((section) => {
          const active = section.id === activeId;
          return (
            <li key={section.id}>
              <button
                type="button"
                aria-current={active ? "page" : undefined}
                data-ui="section-nav-item"
                data-section={section.id}
                data-active={active || undefined}
                onClick={() => onSelect(section.id)}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-accent-600 ${
                  active ? "bg-accent-50 text-accent-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <DiagramIcon className="size-4 shrink-0" />
                {section.title}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
