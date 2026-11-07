import { CodegenCell, CodegenPanel } from "@/components/records/CodegenStatus";
import { FileNameCell, FileSummaryCell, ThumbnailCell } from "@/components/records/FileCell";
import type { ResourceConfig } from "@/components/records/types";
import { CubeIcon, DiagramIcon, ShipIcon } from "@/components/ui/icons";
import { isCodegenActive } from "@/lib/codegen";
import { COLLECTIONS, MANUAL_DATA_FILE, projectDir } from "@/lib/collection-defs";
import { projectStore, projectStores } from "@/lib/collections";
import type { ObjectRecord, Project, Section } from "@/types/records";

const SECTION_FILES = COLLECTIONS.sections.fileFields;
const OBJECT_FILES = COLLECTIONS.objects.fileFields;
const PROJECT_TEXT = COLLECTIONS.projects.textFields;

/** Offered in the Vessel type field; any other type can be typed in too. */
const VESSEL_TYPES = [
  "Bulk carrier",
  "Container ship",
  "Tanker",
  "General cargo",
  "Ro-Ro",
  "Passenger ship",
  "Offshore vessel",
  "Tug",
  "Other",
] as const;

function FolderPath({ dir, folder }: { dir: string; folder: string }) {
  return <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs text-slate-700">child/{dir}/{folder}</code>;
}

/** E.g. "1 section", "3 sections". */
export function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
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

export const projectConfig: ResourceConfig<Project> = {
  id: "projects",
  label: "Ship",
  singular: "ship",
  namePlaceholder: "MV Aurora",
  icon: ShipIcon,
  store: projectStore,
  fileFields: [],
  textFields: [
    {
      key: "imoNumber",
      label: "IMO number",
      placeholder: "e.g. 9074729",
      hint: "7 digits; the last is a check digit.",
      inputMax: 12,
      def: PROJECT_TEXT.imoNumber,
    },
    {
      key: "vesselType",
      label: "Vessel type",
      placeholder: "e.g. Bulk carrier",
      suggestions: VESSEL_TYPES,
      def: PROJECT_TEXT.vesselType,
    },
    {
      key: "description",
      label: "Description",
      placeholder: "Notes about this ship…",
      multiline: true,
      def: PROJECT_TEXT.description,
    },
  ],
  columns: [],
  deleteWarning: (r) => (
    <>
      and its project folder <FolderPath dir={projectStore.dir} folder={r.folder} />: its viewer code, its{" "}
      {plural(r.sectionCount, "section")}, {plural(r.objectCount, "object")} and all their files, will be permanently deleted.
    </>
  ),
};

export interface ProjectConfigs {
  sections: ResourceConfig<Section>;
  objects: ResourceConfig<ObjectRecord>;
}

const configsByProject = new Map<string, ProjectConfigs>();

/** The Library tabs of one ship. The same objects every time for the same project. */
export function projectConfigs(project: Pick<Project, "id" | "folder">): ProjectConfigs {
  let configs = configsByProject.get(project.id);
  if (!configs) {
    configs = makeProjectConfigs(project);
    configsByProject.set(project.id, configs);
  }
  return configs;
}

function makeProjectConfigs(project: Pick<Project, "id" | "folder">): ProjectConfigs {
  const { sections: sectionStore, objects: objectStore } = projectStores(project);
  const sectionConfig: ResourceConfig<Section> = {
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
    links: [{ key: "objectIds", label: "Objects", hint: "This ship's objects used in this section.", store: objectStore }],
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
      { header: "Code", cell: (r) => <CodegenCell section={r} /> },
    ],
    viewExtras: (r) => (
      <CodegenPanel projectId={project.id} section={r} shipDir={projectDir(project.folder)} onChanged={sectionStore.reload} />
    ),
    // Shows generation progress, and picks up the result once it's done.
    refreshWhile: (records) => records.some((r) => isCodegenActive(r.codegen)),
    deleteWarning: (r) => (
      <>
        and its folder <FolderPath dir={sectionStore.dir} folder={r.folder} />, including any files added there in the editor,
        will be permanently deleted.
      </>
    ),
    viewLink: (r) => ({
      href: `/projects/${encodeURIComponent(project.id)}/viewer?section=${encodeURIComponent(r.id)}`,
      label: "Open in viewer",
    }),
  };

  const objectConfig: ResourceConfig<ObjectRecord> = {
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
        and its folder <FolderPath dir={objectStore.dir} folder={r.folder} /> will be permanently deleted.
      </>
    ),
  };

  return { sections: sectionConfig, objects: objectConfig };
}
