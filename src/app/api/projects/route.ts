import { connection } from "next/server";
import { assertSameOrigin, respond } from "@/server/respond";
import { createRecord, getSnapshot } from "@/server/storage";

/** List the projects (ships), each with its number of sections and objects. */
export async function GET() {
  // Always read the folders at request time, never a listing prerendered at build time.
  // Outside respond(): its try/catch would swallow the signal Next uses to stop prerendering.
  await connection();
  return respond(async () => Response.json(await getSnapshot("projects")));
}

/** Create a project from multipart form data: `name`, plus optional `imoNumber`, `vesselType` and `description`. */
export async function POST(request: Request) {
  return respond(async () => {
    assertSameOrigin(request);
    return Response.json(await createRecord("projects", await request.formData()), { status: 201 });
  });
}
