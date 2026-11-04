import type { Section } from "@/shared/diagram";

interface SectionNavProps {
  sections: Section[];
  activeId: string;
  onSelect: (sectionId: string) => void;
}

/** List of drawings: a row on small screens, a column beside the diagram on wider ones. */
export function SectionNav({ sections, activeId, onSelect }: SectionNavProps) {
  return (
    <nav aria-label="Drawings">
      <p className="mb-2 hidden px-2 text-xs font-medium tracking-wide text-slate-500 uppercase md:block">Drawings</p>
      <ul className="flex gap-1 overflow-x-auto md:flex-col">
        {sections.map((section) => {
          const active = section.id === activeId;
          const Icon = section.Icon;
          return (
            <li key={section.id}>
              <button
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => onSelect(section.id)}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-indigo-600 ${
                  active ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon className="size-4 shrink-0" />
                {section.title}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
