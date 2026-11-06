import { assertSameOrigin, readJson, respond } from "@/server/respond";
import {
  CHILD_FILES_FAILURE,
  createChildFile,
  deleteChildFile,
  readChildFile,
  saveChildFile,
  scopeOf,
} from "@/server/child-files";

type Context = { params: Promise<{ path: string[] }> };

// Each takes the editor's scope as GET /api/child-files does: `?project=<folder>` for a ship, otherwise the shared
// files. Paths are relative to ./child, or to ./child/ships for a ship (e.g. mv-aurora/src/main.tsx). Anything
// outside the scope is refused with 403.

/** Open a file: `{ path, content, version }`. */
export async function GET(request: Request, { params }: Context) {
  return respond(
    async () => Response.json(await readChildFile(scopeOf(request), (await params).path)),
    CHILD_FILES_FAILURE,
  );
}

/** Create a file (and missing folders) from `{ content }`. Fails with 409 if it already exists. */
export async function POST(request: Request, { params }: Context) {
  return respond(async () => {
    assertSameOrigin(request);
    const { content = "" } = await readJson(request);
    return Response.json(await createChildFile(scopeOf(request), (await params).path, content), { status: 201 });
  }, CHILD_FILES_FAILURE);
}

/** Save a file from `{ content, version }`, where `version` came from GET. Fails with 409 if the file changed since. */
export async function PUT(request: Request, { params }: Context) {
  return respond(async () => {
    assertSameOrigin(request);
    const { content, version } = await readJson(request);
    return Response.json(await saveChildFile(scopeOf(request), (await params).path, content, version));
  }, CHILD_FILES_FAILURE);
}

/** Delete a file. Folders it leaves empty are removed too. */
export async function DELETE(request: Request, { params }: Context) {
  return respond(async () => {
    assertSameOrigin(request);
    await deleteChildFile(scopeOf(request), (await params).path);
    return new Response(null, { status: 204 });
  }, CHILD_FILES_FAILURE);
}
