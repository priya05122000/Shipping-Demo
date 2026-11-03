import { FileNameCell, FileSummaryCell, ThumbnailCell } from "@/components/records/FileCell";
import type { ResourceConfig } from "@/components/records/types";
import { CubeIcon, DiagramIcon, DocumentIcon } from "@/components/ui/icons";
import { lineDiagramStore, manualStore, objectStore } from "@/lib/collections";
import { FILE_RULES } from "@/lib/files";
import type { LineDiagram, Manual, ObjectRecord } from "@/types/records";

export const lineDiagramConfig: ResourceConfig<LineDiagram> = {
  id: "line-diagrams",
  label: "Line Diagram",
  singular: "line diagram",
  description: "2D line diagrams and schematics.",
  icon: DiagramIcon,
  store: lineDiagramStore,
  fileFields: [{ key: "image", label: "Upload Image", viewLabel: "Image", rule: FILE_RULES.image }],
  columns: [
    { header: "Image Preview", cell: (r, { onView }) => <ThumbnailCell file={r.image} onClick={() => onView(r)} /> },
    { header: "File Name", cell: (r) => <FileNameCell file={r.image} /> },
  ],
};

export const objectConfig: ResourceConfig<ObjectRecord> = {
  id: "objects",
  label: "Object",
  singular: "object",
  description: "3D models paired with their line diagrams.",
  icon: CubeIcon,
  store: objectStore,
  fileFields: [
    { key: "model", label: "Upload 3D Diagram", viewLabel: "3D Diagram", rule: FILE_RULES.model3d },
    { key: "lineDiagram", label: "Upload Line Diagram", viewLabel: "Line Diagram", rule: FILE_RULES.image },
  ],
  columns: [
    { header: "3D Diagram", cell: (r, { onView }) => <FileSummaryCell file={r.model} onClick={() => onView(r)} /> },
    {
      header: "Line Diagram",
      cell: (r, { onView }) => <FileSummaryCell file={r.lineDiagram} onClick={() => onView(r)} />,
    },
  ],
};

export const manualConfig: ResourceConfig<Manual> = {
  id: "manuals",
  label: "Manual",
  singular: "manual",
  description: "PDF manuals and documentation.",
  icon: DocumentIcon,
  store: manualStore,
  fileFields: [{ key: "pdf", label: "Upload Manual", viewLabel: "Manual (PDF)", rule: FILE_RULES.pdf }],
  columns: [
    { header: "PDF Preview", cell: (r, { onView }) => <ThumbnailCell file={r.pdf} onClick={() => onView(r)} /> },
    { header: "File Name", cell: (r) => <FileNameCell file={r.pdf} /> },
  ],
};
