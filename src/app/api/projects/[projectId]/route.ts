import { stopShipCodegen } from "@/server/codegen/jobs";
import { assertSameOrigin, respond } from "@/server/respond";
import { deleteRecord, updateRecord } from "@/server/storage";

type Context = { params: Promise<{ projectId: string }> };

/** Update a project's name and details. Details left out are cleared. */
export async function PUT(request: Request, { params }: Context) {
  return respond(async () => {
    assertSameOrigin(request);
    const { projectId } = await params;
    return Response.json(await updateRecord("projects", projectId, await request.formData()));
  });
}

/** Delete a project's folder: its sections, objects and all their files. Its running code generations are stopped first. */
export async function DELETE(request: Request, { params }: Context) {
  return respond(async () => {
    assertSameOrigin(request);
    const { projectId } = await params;
    await stopShipCodegen(projectId, "The ship was deleted.");
    return Response.json(await deleteRecord("projects", projectId));
  });
}
