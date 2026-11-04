import { assertSameOrigin, readJson, respond } from "@/server/respond";
import {
  CHILD_FILES_FAILURE,
  createChildFile,
  deleteChildFile,
  readChildFile,
  saveChildFile,
} from "@/server/child-files";

type Context = { params: Promise<{ path: string[] }> };

/** Open a file: `{ path, content, version }`. */
export async function GET(_request: Request, { params }: Context) {
  return respond(async () => Response.json(await readChildFile((await params).path)), CHILD_FILES_FAILURE);
}

/** Create a file (and missing folders) from `{ content }`. Fails with 409 if it already exists. */
export async function POST(request: Request, { params }: Context) {
  return respond(async () => {
    assertSameOrigin(request);
    const { content = "" } = await readJson(request);
    return Response.json(await createChildFile((await params).path, content), { status: 201 });
  }, CHILD_FILES_FAILURE);
}

/** Save a file from `{ content, version }`, where `version` came from GET. Fails with 409 if the file changed since. */
export async function PUT(request: Request, { params }: Context) {
  return respond(async () => {
    assertSameOrigin(request);
    const { content, version } = await readJson(request);
    return Response.json(await saveChildFile((await params).path, content, version));
  }, CHILD_FILES_FAILURE);
}

/** Delete a file. Folders it leaves empty are removed too. */
export async function DELETE(request: Request, { params }: Context) {
  return respond(async () => {
    assertSameOrigin(request);
    await deleteChildFile((await params).path);
    return new Response(null, { status: 204 });
  }, CHILD_FILES_FAILURE);
}
