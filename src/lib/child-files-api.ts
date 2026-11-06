import type { ChildEntry, ChildFile, ChildScope } from "@/lib/child-files";
import { request } from "@/lib/request";

const BASE = "/api/child-files";

const jsonBody = (body: unknown): RequestInit => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

/**
 * Client for the child app's files (see src/server/child-files.ts), as one editor sees them: the shared files
 * (e.g. "template/src/main.tsx"), or one ship's folder (e.g. "mv-aurora/src/main.tsx"). Errors are RequestErrors.
 */
export function childFiles(scope: ChildScope) {
  // Every request names the scope, so the server refuses paths outside it.
  const query = scope === null ? "" : `?project=${encodeURIComponent(scope)}`;
  const fileUrl = (path: string) => `${BASE}/${path.split("/").map(encodeURIComponent).join("/")}${query}`;
  return {
    list: () => request<{ entries: ChildEntry[] }>(`${BASE}${query}`).then((result) => result.entries),
    read: (path: string) => request<ChildFile>(fileUrl(path)),
    create: (path: string, content = "") => request<ChildFile>(fileUrl(path), { method: "POST", ...jsonBody({ content }) }),
    /** Status 409 means the file changed on disk since `version`. */
    save: (path: string, content: string, version: string) =>
      request<{ version: string }>(fileUrl(path), { method: "PUT", ...jsonBody({ content, version }) }),
    remove: (path: string) => request<null>(fileUrl(path), { method: "DELETE" }),
  };
}
