import { connection } from "next/server";
import { readPlanUsage } from "@/server/codegen/plan";
import { respond } from "@/server/respond";

/**
 * The usage of the Claude plan Claude Code is signed in with on this machine, which code generation runs on: its
 * 5-hour and weekly limits, and the time generations wait until while one is reached. A read from the last minute is
 * reused; `?fresh=1` reads it again.
 */
export async function GET(request: Request) {
  // Always read at request time, never prerendered at build time. Outside respond(): its try/catch would swallow the
  // signal Next uses to stop prerendering.
  await connection();
  return respond(async () => {
    const fresh = new URL(request.url).searchParams.has("fresh");
    return Response.json(await readPlanUsage({ fresh }));
  }, "Couldn't read the Claude plan's usage.");
}
