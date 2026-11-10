import { request } from "@/lib/request";
import type { CodegenEngine } from "@/types/records";

/** Client for a section's code generation (see src/app/api/projects/[projectId]/[collection]/[id]/codegen). */
function codegenUrl(projectId: string, sectionId: string) {
  return `/api/projects/${encodeURIComponent(projectId)}/sections/${encodeURIComponent(sectionId)}/codegen`;
}

/** Generates the section's code again from its line diagram. Resolves once the generation is queued. */
export function generateCode(projectId: string, sectionId: string, engine: CodegenEngine = "sdk") {
  return request<{ ok: true }>(codegenUrl(projectId, sectionId), {
    method: "POST",
    ...(engine === "cli" && {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ engine }),
    }),
  });
}

/** Switches the section's code to one of its versions. Resolves once its files are in place. */
export function restoreCodeVersion(projectId: string, sectionId: string, version: number) {
  return request<{ ok: true }>(codegenUrl(projectId, sectionId), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ version }),
  });
}

/** Stops the section's code generation. Resolves once the files it wrote are rolled back. */
export function stopCodeGeneration(projectId: string, sectionId: string) {
  return request<{ ok: true }>(codegenUrl(projectId, sectionId), { method: "DELETE" });
}
