import { FileNameCell, FileSummaryCell, ThumbnailCell } from "@/components/records/FileCell";
import type { ResourceConfig } from "@/components/records/types";
import { CubeIcon, DiagramIcon } from "@/components/ui/icons";
import { COLLECTIONS, MANUAL_DATA_FILE } from "@/lib/collection-defs";
import { objectStore, sectionStore } from "@/lib/collections";
import type { ObjectRecord, Section } from "@/types/records";

const SECTION_FILES = COLLECTIONS.sections.fileFields;
const OBJECT_FILES = COLLECTIONS.objects.fileFields;

function FolderPath({ dir, folder }: { dir: string; folder: string }) {
  return <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs text-slate-700">child/{dir}/{folder}</code>;
}

/** The manual, and what was read from it into manual-data.json when it was uploaded. */
function ManualCell({ section }: { section: Section }) {
  const data = section.manualData;
  // section.json can be edited by hand, so the summary is checked before it's shown.
  const read = section.manual && data && typeof data.components === "number";
  return (
    <div>
      <FileNameCell file={section.manual} />
      {read &&
        (typeof data.error === "string" ? (
          <p className="mt-0.5 text-xs text-amber-600" title={data.error}>
            No component data
          </p>
        ) : (
          <p className="mt-0.5 text-xs text-emerald-600" title={`Saved in ${MANUAL_DATA_FILE}`}>
            {data.components} component{data.components === 1 ? "" : "s"} read
          </p>
        ))}
    </div>
  );
}

export const sectionConfig: ResourceConfig<Section> = {
  id: "sections",
  label: "Section",
  singular: "section",
  namePlaceholder: "Engine room",
  icon: DiagramIcon,
  store: sectionStore,
  fileFields: [
    { key: "lineDiagram", label: "Upload Line Diagram", viewLabel: "Line Diagram", ...SECTION_FILES.lineDiagram },
    { key: "manual", label: "Upload Manual", viewLabel: "Manual (PDF)", ...SECTION_FILES.manual },
  ],
  links: [{ key: "objectIds", label: "Objects", hint: "Shared objects used in this section.", store: objectStore }],
  columns: [
    { header: "Line Diagram", cell: (r, { onView }) => <ThumbnailCell file={r.lineDiagram} onClick={() => onView(r)} /> },
    { header: "Manual", cell: (r) => <ManualCell section={r} /> },
    {
      header: "Objects",
      cell: (r) => (
        <span className={`text-sm ${r.objectIds.length ? "text-slate-700" : "text-slate-400"}`}>
          {r.objectIds.length === 0 ? "None" : `${r.objectIds.length} object${r.objectIds.length === 1 ? "" : "s"}`}
        </span>
      ),
    },
  ],
  deleteWarning: (r) => (
    <>
      and its folder <FolderPath dir={COLLECTIONS.sections.dir} folder={r.folder} />, including any files added there in the editor,
      will be permanently deleted.
    </>
  ),
  viewLink: (r) => ({ href: `/viewer?section=${encodeURIComponent(r.id)}`, label: "Open in viewer" }),
};

export const objectConfig: ResourceConfig<ObjectRecord> = {
  id: "objects",
  label: "Object",
  singular: "object",
  namePlaceholder: "Main pump assembly",
  icon: CubeIcon,
  store: objectStore,
  fileFields: [
    { key: "model", label: "Upload 3D Diagram", viewLabel: "3D Diagram", ...OBJECT_FILES.model },
    { key: "lineDiagram", label: "Upload Line Diagram", viewLabel: "Line Diagram", ...OBJECT_FILES.lineDiagram },
  ],
  columns: [
    { header: "3D Diagram", cell: (r, { onView }) => <FileSummaryCell file={r.model} onClick={() => onView(r)} /> },
    {
      header: "Line Diagram",
      cell: (r, { onView }) => <FileSummaryCell file={r.lineDiagram} onClick={() => onView(r)} />,
    },
  ],
  deleteWarning: (r) => (
    <>
      and its folder <FolderPath dir={COLLECTIONS.objects.dir} folder={r.folder} /> will be permanently deleted.
    </>
  ),
};
