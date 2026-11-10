import { cancelCodegen, requestCodegen, restoreCodegenVersion } from "@/server/codegen/jobs";
import { assertSameOrigin, parseProjectCollection, readJson, respond } from "@/server/respond";
import { ApiError } from "@/server/storage";

type Context = { params: Promise<{ projectId: string; collection: string; id: string }> };

/** Only sections have generated code. */
function parseSections(collection: string) {
  if (parseProjectCollection(collection) !== "sections") throw new ApiError(404, "Only sections have generated code.");
}

/** Generate a section's React code again from its line diagram, replacing a generation that's still running. */
export async function POST(request: Request, { params }: Context) {
  return respond(async () => {
    assertSameOrigin(request);
    const { projectId, collection, id } = await params;
    parseSections(collection);
    await requestCodegen(projectId, id);
    return Response.json({ ok: true }, { status: 202 });
  });
}

/**
 * Switch a section's code to one of its versions, from JSON `{ "version": 2 }`. Responds once its files are in place;
 * 409 if that version doesn't type-check with the ship's current shared components (nothing is changed then), or
 * while the ship's code is being generated.
 */
export async function PUT(request: Request, { params }: Context) {
  return respond(async () => {
    assertSameOrigin(request);
    const { projectId, collection, id } = await params;
    parseSections(collection);
    const { version } = await readJson(request);
    if (!Number.isSafeInteger(version) || (version as number) < 1) throw new ApiError(400, "`version` must be a version number, e.g. 2.");
    await restoreCodegenVersion(projectId, id, version as number);
    return Response.json({ ok: true });
  });
}

/** Stop a section's code generation. Responds once the files it wrote are rolled back. */
export async function DELETE(request: Request, { params }: Context) {
  return respond(async () => {
    assertSameOrigin(request);
    const { projectId, collection, id } = await params;
    parseSections(collection);
    await cancelCodegen(projectId, id);
    return Response.json({ ok: true });
  });
}
