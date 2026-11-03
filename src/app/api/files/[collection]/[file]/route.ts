import { parseSlug, respond } from "@/server/respond";
import { readUpload } from "@/server/storage";

type Context = { params: Promise<{ collection: string; file: string }> };

/** Serve an uploaded file. Stored names are unique per upload, so responses can be cached forever. */
export async function GET(_request: Request, { params }: Context) {
  return respond(async () => {
    const { collection, file } = await params;
    const { bytes, contentType } = await readUpload(parseSlug(collection), file);
    const headers = new Headers({
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    });
    if (contentType === "image/svg+xml") {
      // Uploaded SVGs could contain scripts; never let them run if the file is opened directly.
      headers.set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox");
    }
    return new Response(new Uint8Array(bytes), { headers });
  });
}
