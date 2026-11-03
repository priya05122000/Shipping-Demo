import type { ComponentType, ReactNode, SVGProps } from "react";
import type { FileRule } from "@/lib/files";
import type { CollectionStore } from "@/lib/storage";
import type { BaseRecord, FileKey, StoredFile } from "@/types/records";

export type TabId = "line-diagrams" | "objects" | "manuals";

export interface FileFieldConfig<T> {
  key: FileKey<T>;
  /** Form label, e.g. "Upload 3D Diagram". */
  label: string;
  /** Heading in the View modal, e.g. "3D Diagram". */
  viewLabel: string;
  rule: FileRule;
}

export interface ColumnContext<T> {
  onView: (record: T) => void;
}

export interface ColumnDef<T> {
  header: string;
  cell: (record: T, context: ColumnContext<T>) => ReactNode;
  className?: string;
}

export interface ResourceConfig<T extends BaseRecord> {
  id: TabId;
  /** Tab / heading label, e.g. "Line Diagram". */
  label: string;
  /** Lower-case noun for messages, e.g. "line diagram". */
  singular: string;
  description: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  store: CollectionStore<T>;
  fileFields: FileFieldConfig<T>[];
  /** Columns between Name and Actions. */
  columns: ColumnDef<T>[];
}

export function getFile<T>(record: T, key: FileKey<T>): StoredFile {
  return record[key] as unknown as StoredFile;
}
