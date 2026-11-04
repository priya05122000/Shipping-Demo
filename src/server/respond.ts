import { isCollectionSlug, type CollectionSlug } from "@/lib/collection-defs";
import { ApiError } from "@/server/storage";

export function parseSlug(value: string): CollectionSlug {
  if (!isCollectionSlug(value)) throw new ApiError(404, `Unknown collection "${value}".`);
  return value;
}

/**
 * Refuses requests that another website sent from the user's browser (CSRF). Browsers label requests with
 * Sec-Fetch-Site; older ones only send Origin. Tools like curl send neither and are allowed.
 */
export function assertSameOrigin(request: Request) {
  const site = request.headers.get("sec-fetch-site");
  const origin = request.headers.get("origin");
  let sameOrigin = site === "same-origin";
  if (!site) {
    try {
      sameOrigin = !origin || new URL(origin).host === request.headers.get("host");
    } catch {
      sameOrigin = false; // e.g. "Origin: null"
    }
  }
  if (!sameOrigin) throw new ApiError(403, "Requests from other sites aren't allowed.");
}

/** Parses a JSON object body. Requiring the JSON content type also makes browsers preflight cross-site requests. */
export async function readJson(request: Request): Promise<Record<string, unknown>> {
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    throw new ApiError(415, "Send the request body as JSON.");
  }
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ApiError(400, "The body must be a JSON object.");
  return body as Record<string, unknown>;
}

/** Runs a handler and turns errors into JSON `{ error }` responses. `failure` is shown for unexpected errors. */
export async function respond(
  handler: () => Promise<Response>,
  failure = "Something went wrong while saving to the child app's folder.",
): Promise<Response> {
  try {
    return await handler();
  } catch (error) {
    if (error instanceof ApiError) return Response.json({ error: error.message }, { status: error.status });
    console.error(error);
    return Response.json({ error: failure }, { status: 500 });
  }
}
