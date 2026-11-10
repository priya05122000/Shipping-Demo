import { reconcileCodegen, stopCodegen } from "@/server/codegen/jobs";
import { assertSameOrigin, parseProjectCollection, respond } from "@/server/respond";
import { deleteRecord, updateRecord } from "@/server/storage";

type Context = { params: Promise<{ projectId: string; collection: string; id: string }> };

/**
 * Update a record's name and optionally replace files. Omitted files are kept. A section's new line diagram starts
 * generating its React code again; removing it stops a generation that's still running.
 */
export async function PUT(request: Request, { params }: Context) {
  return respond(async () => {
    assertSameOrigin(request);
    const { projectId, collection, id } = await params;
    const slug = parseProjectCollection(collection);
    const result = await updateRecord(slug, id, await request.formData(), projectId, { codegenEngine: "cli" });
    if (slug === "sections") await reconcileCodegen(projectId, result.record);
    return Response.json(result);
  });
}

/** Delete a record and its files. A section's running code generation is stopped first, so it can't write into the folder. */
export async function DELETE(request: Request, { params }: Context) {
  return respond(async () => {
    assertSameOrigin(request);
    const { projectId, collection, id } = await params;
    const slug = parseProjectCollection(collection);
    if (slug === "sections") await stopCodegen(projectId, id, "The section was deleted.");
    return Response.json(await deleteRecord(slug, id, projectId));
  });
}
