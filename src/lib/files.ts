/** Upload size limits. Files are saved to the local data folder, so these are policy, not storage, limits. */
export const MAX_FILE_SIZE = 2 * 1024 * 1024;
export const MAX_PDF_SIZE = 5 * 1024 * 1024;

export type FileKind = "image" | "model3d" | "pdf";

/**
 * The view an object's file is shown in: "2d", its line diagram (ObjectSymbol2D draws it), or "3d", its 3D diagram
 * (ObjectModel3D shows it). Both can be images for now, so the view, not the format, tells them apart. It's part of the
 * file's stored name and of its metadata, so the code generation agent, the Library and the viewer read it the same way.
 */
export type DiagramView = "2d" | "3d";

/**
 * Stored name of a file uploaded for one view: made from its record's name and tagged with the view, then a unique
 * part, e.g. "fuel-pump-2d-77aa01ff.png" and "fuel-pump-3d-3be0d14c.glb". The view is the tag right before the unique
 * part, so a name that itself ends in "2d" or "3d" still reads correctly ("pump-2d-3d-3be0d14c.png" is a 3D file).
 */
export const VIEW_FILE_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*-(2d|3d)-[0-9a-f]{8}\.[a-z0-9]+$/;

/** The stored name for a file uploaded for `view`. `baseName` is made by slugify(), `unique` is 8 hex digits. */
export function viewFileName(baseName: string, view: DiagramView, unique: string, extension: string): string {
  return `${baseName}-${view}-${unique}.${extension}`;
}

/** The view a stored name is tagged with, or null for a name without one (e.g. "manual-a1c2e3f4.pdf"). */
export function viewOfStoredName(storedName: string): DiagramView | null {
  return (VIEW_FILE_NAME.exec(storedName)?.[1] as DiagramView | undefined) ?? null;
}

export interface FileRule {
  kind: FileKind;
  extensions: readonly string[];
  /** MIME prefixes/types considered valid when the browser reports one. */
  mimeTypes: readonly string[];
  maxSize: number;
  /** Human-readable list of formats, e.g. "JPG, PNG, WEBP, SVG". */
  label: string;
}

export const FILE_RULES = {
  image: {
    kind: "image",
    extensions: ["jpg", "jpeg", "png", "webp", "svg"],
    mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/svg+xml"],
    maxSize: MAX_FILE_SIZE,
    label: "JPG, JPEG, PNG, WEBP, SVG",
  },
  model3d: {
    kind: "model3d",
    // For now an image is accepted too, until objects have real 3D models. The viewer's ObjectModel3D shows it as a
    // flat picture. Images still count as kind "image" (fileKindFromExtension checks the image rule first).
    extensions: ["glb", "gltf", "obj", "fbx", "stl", "blend", "jpg", "jpeg", "png", "webp", "svg"],
    // Browsers report inconsistent or empty MIME types for 3D formats, so only the extension is checked.
    mimeTypes: [],
    maxSize: MAX_FILE_SIZE,
    label: "GLB, GLTF, OBJ, FBX, STL, BLEND, or for now an image (JPG, PNG, WEBP, SVG)",
  },
  pdf: {
    kind: "pdf",
    extensions: ["pdf"],
    mimeTypes: ["application/pdf"],
    maxSize: MAX_PDF_SIZE,
    label: "PDF",
  },
} as const satisfies Record<FileKind, FileRule>;

/** Value for an <input type="file" accept> attribute. */
export function acceptAttribute(rule: FileRule): string {
  return [...rule.extensions.map((ext) => `.${ext}`), ...rule.mimeTypes].join(",");
}

export function getExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot + 1).toLowerCase();
}

/** Returns an error message, or null if the file is acceptable. Runs in the browser and on the server. */
export function validateFile(file: File, rule: FileRule): string | null {
  const ext = getExtension(file.name);
  if (!rule.extensions.includes(ext)) {
    return `"${file.name}" isn't a supported format. Allowed: ${rule.label}.`;
  }
  // Generic/empty MIME types are common, so only reject a MIME type that clearly contradicts the rule.
  const mime = file.type.toLowerCase();
  const isGeneric = mime === "" || mime === "application/octet-stream";
  if (rule.mimeTypes.length > 0 && !isGeneric && !rule.mimeTypes.includes(mime)) {
    return `"${file.name}" looks like ${mime}, which isn't allowed here. Allowed: ${rule.label}.`;
  }
  if (file.size === 0) {
    return `"${file.name}" is empty.`;
  }
  if (file.size > rule.maxSize) {
    return `"${file.name}" is ${formatBytes(file.size)}. The maximum is ${formatBytes(rule.maxSize)} for this field.`;
  }
  return null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function fileKindFromExtension(extension: string): FileKind | null {
  for (const rule of Object.values(FILE_RULES)) {
    if ((rule.extensions as readonly string[]).includes(extension)) return rule.kind;
  }
  return null;
}
