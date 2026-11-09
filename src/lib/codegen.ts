import type { CodegenStatus, CodegenVersion, SectionCodegen } from "@/types/records";

/**
 * Where the AI-generated React code goes in a ship's project (child/ships/<ship>/), shared by the server, which
 * writes it, and the Library, which shows it. The ship's viewer loads the two entry files from each section's folder.
 */
export const CODEGEN_ENTRY_2D = "Diagram2D.tsx";
export const CODEGEN_ENTRY_3D = "Diagram3D.tsx";
/** The ship's shared schematic components, created by its first generation and reused by later ones. */
export const CODEGEN_SHARED_DIR = "src/shared/schematic";
/**
 * In the ship's folder, outside src/ so the viewer never builds it:
 *   codegen/generations.json        the ship's finished generations, which decide between the first and second prompt
 *   codegen/<section ID>/v<N>/      each version of a section's generated files
 */
export const CODEGEN_DIR = "codegen";
export const CODEGEN_STATE_FILE = `${CODEGEN_DIR}/generations.json`;
/** One JSON line per generation, however it ended: its status, tokens and cost (see src/server/codegen/jobs.ts). */
export const CODEGEN_USAGE_FILE = `${CODEGEN_DIR}/usage.jsonl`;

/**
 * In an object's folder (child/ships/<ship>/src/objects/<ID>/): what code generation learned from the object's line
 * diagram image the first time a section used it, so later generations don't look at the image again (see
 * src/server/codegen/objects.ts, and the viewer's src/objects/card.ts).
 */
export const OBJECT_CARD_FILE = "card.json";

/** Where a version's files are kept, relative to the ship's folder, e.g. "codegen/SEC-001/v3". */
export function codegenVersionDir(sectionId: string, version: number): string {
  return `${CODEGEN_DIR}/${sectionId}/v${version}`;
}

const STATUSES: readonly CodegenStatus[] = ["queued", "running", "done", "failed", "cancelled"];

/** Whether the generation is waiting or running. */
export function isCodegenActive(codegen: SectionCodegen | undefined): boolean {
  return codegen?.status === "queued" || codegen?.status === "running";
}

/** A section.json's `codegen` value, checked (the file can be edited by hand), or undefined if it isn't usable. */
export function readCodegen(value: unknown): SectionCodegen | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const codegen = value as Partial<SectionCodegen>;
  if (
    typeof codegen.runId !== "string" ||
    typeof codegen.lineDiagram !== "string" ||
    typeof codegen.requestedAt !== "string" ||
    !STATUSES.includes(codegen.status as CodegenStatus)
  ) {
    return undefined;
  }
  return codegen as SectionCodegen;
}

function isVersionNumber(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

/** A section.json's `codegenVersions`, keeping only usable entries, oldest first. */
export function readCodegenVersions(value: unknown): CodegenVersion[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is CodegenVersion => {
      const version = entry as Partial<CodegenVersion> | null;
      return (
        isVersionNumber(version?.version) &&
        typeof version.finishedAt === "string" &&
        (version.mode === "first" || version.mode === "second") &&
        typeof version.lineDiagramName === "string" &&
        Array.isArray(version.files) &&
        version.files.every((file) => typeof file === "string")
      );
    })
    .sort((a, b) => a.version - b.version);
}

/** A section.json's `codegenVersion`, or undefined if it isn't a version number. */
export function readActiveVersion(value: unknown): number | undefined {
  return isVersionNumber(value) ? value : undefined;
}
