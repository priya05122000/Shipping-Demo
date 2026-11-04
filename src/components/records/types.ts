import type { ComponentType, ReactNode, SVGProps } from "react";
import type { FileRule } from "@/lib/files";
import type { CollectionStore } from "@/lib/storage";
import type { BaseRecord, FileKey, StoredFile } from "@/types/records";

export type TabId = "sections" | "objects";

export interface FileFieldConfig<T> {
  key: FileKey<T>;
  /** Form label, e.g. "Upload 3D Diagram". */
  label: string;
  /** Heading in the View modal, e.g. "3D Diagram". */
  viewLabel: string;
  rule: FileRule;
  /** Required files must be uploaded on create and can only be replaced. Optional ones can also be removed. */
  required: boolean;
}

/** Keys of T whose value is a list of IDs. */
export type LinkKey<T> = {
  [K in keyof T]-?: T[K] extends string[] ? K : never;
}[keyof T] &
  string;

/** A list of records picked from another collection, e.g. the objects a section uses. */
export interface LinkFieldConfig<T> {
  key: LinkKey<T>;
  /** Form and View label, e.g. "Objects". */
  label: string;
  hint: string;
  store: CollectionStore<BaseRecord>;
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
  /** Tab / heading label, e.g. "Section". */
  label: string;
  /** Lower-case noun for messages, e.g. "section". */
  singular: string;
  /** Placeholder for the Name field. */
  namePlaceholder: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  store: CollectionStore<T>;
  fileFields: FileFieldConfig<T>[];
  links?: LinkFieldConfig<T>[];
  /** Columns between Name and Actions. */
  columns: ColumnDef<T>[];
  /** What deleting removes, shown in the confirmation after the record's ID and name. */
  deleteWarning: (record: T) => ReactNode;
  /** Extra link in the View modal, e.g. to open a section in the viewer. */
  viewLink?: (record: T) => { href: string; label: string };
}

export function getFile<T>(record: T, key: FileKey<T>): StoredFile | undefined {
  return record[key] as unknown as StoredFile | undefined;
}

export function getLinks<T>(record: T, key: LinkKey<T>): string[] {
  return (record[key] as unknown as string[] | undefined) ?? [];
}
