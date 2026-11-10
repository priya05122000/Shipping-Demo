import type { Section } from "../diagram";
import { Badge, CubeIcon, EmptyState } from "../ui";

/** The shared objects picked for the section. A three.js scene of their 3D models will render here. */
export function View3D({ section }: { section: Section }) {
  if (section.objects.length === 0) {
    return (
      <EmptyState icon={<CubeIcon className="size-6" />} title="No objects in this section">
        Pick objects for {section.title} in the Library.
      </EmptyState>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <p className="mb-3 text-xs text-slate-500">3D rendering is coming soon. These are the objects used in {section.title}.</p>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {section.objects.map((object) => (
          <li key={object.id} className="overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
            <div className="flex aspect-video items-center justify-center bg-slate-50 text-slate-300">
              {object.lineDiagram ? (
                <img src={object.lineDiagram} alt={`${object.name} line diagram`} className="size-full object-contain" />
              ) : (
                <CubeIcon className="size-8" />
              )}
            </div>
            <div className="flex items-center gap-2 border-t border-slate-200 p-3">
              <Badge>{object.id}</Badge>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">{object.name}</p>
                <p className="truncate text-xs text-slate-500">{object.modelName}</p>
              </div>
              {object.model && (
                <a
                  href={object.model}
                  download={object.modelName || undefined}
                  className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
                >
                  Download
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
