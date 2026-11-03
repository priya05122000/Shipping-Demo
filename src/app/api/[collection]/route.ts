import { parseSlug, respond } from "@/server/respond";
import { createRecord, getSnapshot } from "@/server/storage";

type Context = { params: Promise<{ collection: string }> };

/** List a tab's records. */
export async function GET(_request: Request, { params }: Context) {
  return respond(async () => {
    const slug = parseSlug((await params).collection);
    return Response.json(await getSnapshot(slug));
  });
}

/** Create a record from multipart form data: `name` plus one file per file field. */
export async function POST(request: Request, { params }: Context) {
  return respond(async () => {
    const slug = parseSlug((await params).collection);
    return Response.json(await createRecord(slug, await request.formData()), { status: 201 });
  });
}
