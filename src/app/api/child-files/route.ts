import { connection } from "next/server";
import { respond } from "@/server/respond";
import { CHILD_FILES_FAILURE, listChildFiles, scopeOf } from "@/server/child-files";

/**
 * List the child app's files for an editor, as a tree: the shared files (everything but the ships), or with
 * `?project=<folder>` only that ship's folder. node_modules and .git are left out.
 */
export async function GET(request: Request) {
  // Always read the folder at request time, never a listing prerendered at build time.
  // Outside respond(): its try/catch would swallow the signal Next uses to stop prerendering.
  await connection();
  return respond(async () => Response.json({ entries: await listChildFiles(scopeOf(request)) }), CHILD_FILES_FAILURE);
}
