import { assertSameOrigin, parseProjectCollection, respond } from "@/server/respond";
import { createRecord, getSnapshot } from "@/server/storage";

type Context = { params: Promise<{ projectId: string; collection: string }> };

/** List a project's sections or objects. */
export async function GET(_request: Request, { params }: Context) {
  return respond(async () => {
    const { projectId, collection } = await params;
    return Response.json(await getSnapshot(parseProjectCollection(collection), projectId));
  });
}

/** Create a record in a project from multipart form data: `name` plus one file per file field. */
export async function POST(request: Request, { params }: Context) {
  return respond(async () => {
    assertSameOrigin(request);
    const { projectId, collection } = await params;
    const slug = parseProjectCollection(collection);
    return Response.json(await createRecord(slug, await request.formData(), projectId), { status: 201 });
  });
}
