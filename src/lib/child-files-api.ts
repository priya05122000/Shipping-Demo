import type { ChildEntry, ChildFile } from "@/lib/child-files";
import { request } from "@/lib/request";

const BASE = "/api/child-files";

const fileUrl = (path: string) => `${BASE}/${path.split("/").map(encodeURIComponent).join("/")}`;

const jsonBody = (body: unknown): RequestInit => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

/** Client for the child app's files (see src/server/child-files.ts). Errors are RequestErrors. */
export const childFiles = {
  list: () => request<{ entries: ChildEntry[] }>(BASE).then((result) => result.entries),
  read: (path: string) => request<ChildFile>(fileUrl(path)),
  create: (path: string, content = "") => request<ChildFile>(fileUrl(path), { method: "POST", ...jsonBody({ content }) }),
  /** Status 409 means the file changed on disk since `version`. */
  save: (path: string, content: string, version: string) =>
    request<{ version: string }>(fileUrl(path), { method: "PUT", ...jsonBody({ content, version }) }),
  remove: (path: string) => request<null>(fileUrl(path), { method: "DELETE" }),
};
