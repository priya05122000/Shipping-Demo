import { assertSameOrigin, parseProjectCollection, respond } from "@/server/respond";
import { deleteRecord, updateRecord } from "@/server/storage";

type Context = { params: Promise<{ projectId: string; collection: string; id: string }> };

/** Update a record's name and optionally replace files. Omitted files are kept. */
export async function PUT(request: Request, { params }: Context) {
  return respond(async () => {
    assertSameOrigin(request);
    const { projectId, collection, id } = await params;
    return Response.json(await updateRecord(parseProjectCollection(collection), id, await request.formData(), projectId));
  });
}

/** Delete a record and its files. */
export async function DELETE(request: Request, { params }: Context) {
  return respond(async () => {
    assertSameOrigin(request);
    const { projectId, collection, id } = await params;
    return Response.json(await deleteRecord(parseProjectCollection(collection), id, projectId));
  });
}
