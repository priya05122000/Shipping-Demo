import { connection } from "next/server";
import { respond } from "@/server/respond";
import { CHILD_FILES_FAILURE, listChildFiles } from "@/server/child-files";

/** List the child app's files for the editor, as a tree. node_modules and .git are left out. */
export async function GET() {
  // Always read the folder at request time, never a listing prerendered at build time.
  // Outside respond(): its try/catch would swallow the signal Next uses to stop prerendering.
  await connection();
  return respond(async () => Response.json({ entries: await listChildFiles() }), CHILD_FILES_FAILURE);
}
