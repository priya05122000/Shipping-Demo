import { request } from "@/lib/request";
import type { PlanUsage } from "@/types/records";

/** Client for the Claude plan's usage (see src/app/api/claude/usage). `fresh` reads it again rather than reusing a recent read. */
export function getPlanUsage(fresh = false) {
  return request<PlanUsage>(`/api/claude/usage${fresh ? "?fresh=1" : ""}`);
}
