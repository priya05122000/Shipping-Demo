/** A failed API call. `status` is the HTTP status, or 0 when the server couldn't be reached. */
export class RequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/** Calls a JSON API route. Failures throw a RequestError carrying the server's `{ error }` message. */
export async function request<R>(url: string, init?: RequestInit): Promise<R> {
  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store", ...init });
  } catch {
    throw new RequestError("Couldn't reach the local server. Is `npm run dev` still running?", 0);
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new RequestError(body?.error ?? `Request failed (${response.status}).`, response.status);
  return body as R;
}
