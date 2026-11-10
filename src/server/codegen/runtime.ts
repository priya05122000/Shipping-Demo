import crypto from "node:crypto";
import { isCodegenActive, readCodegen } from "@/lib/codegen";
import type { CodegenEngine, SectionCodegen } from "@/types/records";

/**
 * State of this server process's code generations, kept on globalThis so every route bundle shares it (like the
 * write queue in storage.ts). Light on purpose: storage.ts imports it, while the Agent SDK is only loaded by jobs.
 */
export interface Job {
  /** `${projectId}/${sectionId}`: a section has at most one job at a time. */
  key: string;
  projectId: string;
  sectionId: string;
  runId: string;
  controller: AbortController;
  /** Why it was cancelled, saved as the section's codegen error. */
  cancelReason?: string;
  /**
   * Set when it was stopped because something went wrong rather than on request (e.g. a path changed under a tool
   * call): it's then saved as failed, with this as the error.
   */
  failure?: string;
  /** Settles once the job has finished, including rolling back and saving its final status. */
  done: Promise<void>;
  /** Settles once the jobs this one replaced (for the same section) have finished rolling back. */
  replaced: Promise<void>;
}

interface Runtime {
  /** Generations this process knows about (queued or running), by run ID, with what each is doing right now. */
  runs: Map<string, { progress?: string; latestEvent?: string }>;
  /** Jobs by Job.key. */
  jobs: Map<string, Job>;
  /**
   * The last job of each ship, by project ID: a ship's jobs run one at a time, since they share its components. A
   * restore of a section's version takes the ship's turn too.
   */
  queues: Map<string, Promise<void>>;
  /**
   * Settles once every job started so far, of any ship, has finished: jobs run one at a time across ships too, since
   * any of them may change the template. Never rejects.
   */
  jobChain: Promise<void>;
  /** Restores of a section's version in progress, by Job.key; each settles when it has finished or rolled back. */
  restores: Map<string, Promise<void>>;
}

const shared = ((globalThis as { __shipCodegen?: Partial<Runtime> }).__shipCodegen ??= {});
// Filled field by field, so a process started with an earlier version of this module gets the new fields too.
shared.runs ??= new Map();
shared.jobs ??= new Map();
shared.queues ??= new Map();
shared.restores ??= new Map();
shared.jobChain ??= Promise.resolve();
export const runtime = shared as Runtime;

/** A new queued generation for a section whose line diagram was just saved, known to this process from now on. */
export function queueRun(
  lineDiagram: string,
  options: { engine?: CodegenEngine; drawingHash?: string } = {},
): SectionCodegen {
  const runId = crypto.randomBytes(6).toString("hex");
  runtime.runs.set(runId, {});
  return {
    runId,
    status: "queued",
    lineDiagram,
    requestedAt: new Date().toISOString(),
    engine: options.engine ?? "sdk",
    ...(options.drawingHash && { drawingHash: options.drawingHash }),
  };
}

/** Publishes a parsed agent event to section listings while the job is active. */
export function setRunEvent(runId: string, event: string) {
  const run = runtime.runs.get(runId);
  if (run) {
    run.progress = event;
    run.latestEvent = event;
  }
}

/**
 * A section's codegen as the Library shows it: with live progress while it runs, and marked as interrupted if it
 * was queued or running in an earlier server process (e.g. the dev server restarted), which nothing will finish.
 */
export function presentCodegen(value: unknown): SectionCodegen | undefined {
  const codegen = readCodegen(value);
  if (!codegen || !isCodegenActive(codegen)) return codegen;
  const run = runtime.runs.get(codegen.runId);
  if (!run) {
    return {
      ...codegen,
      status: "failed",
      error: "Interrupted: the server stopped before the code was finished. Use Generate again to retry.",
    };
  }
  return run.progress || run.latestEvent
    ? { ...codegen, ...(run.progress && { progress: run.progress }), ...(run.latestEvent && { latestEvent: run.latestEvent }) }
    : codegen;
}
