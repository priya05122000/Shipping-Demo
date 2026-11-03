import { parseSlug, respond } from "@/server/respond";
import { deleteRecord, updateRecord } from "@/server/storage";

type Context = { params: Promise<{ collection: string; id: string }> };

/** Update a record's name and optionally replace files. Omitted files are kept. */
export async function PUT(request: Request, { params }: Context) {
  return respond(async () => {
    const { collection, id } = await params;
    return Response.json(await updateRecord(parseSlug(collection), id, await request.formData()));
  });
}

/** Delete a record and its files. */
export async function DELETE(_request: Request, { params }: Context) {
  return respond(async () => {
    const { collection, id } = await params;
    return Response.json(await deleteRecord(parseSlug(collection), id));
  });
}
