/** Upload size limits. Files are saved to the local data folder, so these are policy, not storage, limits. */
export const MAX_FILE_SIZE = 2 * 1024 * 1024;
export const MAX_PDF_SIZE = 5 * 1024 * 1024;

export type FileKind = "image" | "model3d" | "pdf";

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
    extensions: ["glb", "gltf", "obj", "fbx", "stl", "blend"],
    // Browsers report inconsistent or empty MIME types for 3D formats, so only the extension is checked.
    mimeTypes: [],
    maxSize: MAX_FILE_SIZE,
    label: "GLB, GLTF, OBJ, FBX, STL, BLEND",
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
