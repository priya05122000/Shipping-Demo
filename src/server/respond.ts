import { isCollectionSlug, type CollectionSlug } from "@/lib/collection-defs";
import { ApiError } from "@/server/storage";

export function parseSlug(value: string): CollectionSlug {
  if (!isCollectionSlug(value)) throw new ApiError(404, `Unknown collection "${value}".`);
  return value;
}

/** Runs a handler and turns errors into JSON `{ error }` responses. */
export async function respond(handler: () => Promise<Response>): Promise<Response> {
  try {
    return await handler();
  } catch (error) {
    if (error instanceof ApiError) return Response.json({ error: error.message }, { status: error.status });
    console.error(error);
    return Response.json({ error: "Something went wrong while saving to the local data folder." }, { status: 500 });
  }
}
