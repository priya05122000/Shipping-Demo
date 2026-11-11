import fs from "node:fs/promises";
import path from "node:path";
import {
  CODEGEN_ENTRY_2D,
  CODEGEN_ENTRY_3D,
  CODEGEN_SHARED_DIR,
  CODEGEN_STATE_FILE,
  CODEGEN_USAGE_FILE,
  codegenVersionFolder,
  isCodegenActive,
  parseVersionFolder,
  readCodegen,
} from "@/lib/codegen";
import { getExtension } from "@/lib/files";
import { CHILD_DIR, errorCode, writeAtomic } from "@/server/child-dir";
import {
  ApiError,
  findCodegenTarget,
  patchSectionCodegen,
  type CodegenSection,
  type CodegenState,
  type CodegenTarget,
} from "@/server/storage";
import type { CodegenLimit, CodegenMode, CodegenObjects, CodegenUsage, CodegenVersion, SectionCodegen } from "@/types/records";
import { AgentError, IMAGE_MEDIA_TYPES, MODEL, runAgent, type AgentImage } from "./agent";
import { checkCards, objectAccess, objectImages, objectReads, objectsPrompt, planObjects, settleCards, type ObjectPlan } from "./objects";
import { PlanLimitError, planLimitUntil, setPlanWait, sleepUntil, UNKNOWN_RESET_WAIT_MS } from "./plan";
import { assertPlainPath, CodegenPolicy, FileJournal, listGeneratedFiles, pathProblem, toLabel } from "./policy";
import { renderPrompt, type PromptValues } from "./prompts";
import { queueRun, runtime, type Job } from "./runtime";
import { applyStage, createStage, discardStage, discardStaleStages, type AppliedStage, type Stage } from "./staging";
import { projectTree, requiredReads } from "./structure";
import { diagnosticsBlock, formatDiagnostics, TypeChecker, type Diagnostic } from "./typecheck";
import { dataBlock, quoteText } from "./untrusted";

/**
 * Generates a section's 2D and 3D React code from its line diagram, with the Claude Agent SDK (see agent.ts):
 *   1. Uploading a line diagram queues a generation in section.json (storage.ts); the API route then calls
 *      reconcileCodegen, which starts a job for it, and stops a job still working on an older one.
 *   2. Jobs run one at a time, across ships, so generations don't compete for the machine (each type-checks a whole
 *      project) and a stage left over is always a stopped one's (staging.ts). When a job's turn comes, the ship's
 *      codegen/generations.json decides the prompt: "first" if it lists no finished generation, "second" if it does.
 *      The prompt includes the file trees of the ship's project and of the shared viewer (child/core), and the agent
 *      must read the files its code builds on before it writes anything (structure.ts).
 *   3. The agent writes the code into the ship's project: the section's next version, in a folder of its own inside
 *      the section's folder (src/sections/<folder>/v<N>/: Diagram2D.tsx, Diagram3D.tsx and what they use), and shared
 *      components in src/shared/schematic/. The code in use, if the section has some, is copied into the new folder
 *      first, for the agent to change; earlier version folders can't be written, so they stay as they were. It builds
 *      on the shared viewer (@shipdocs/viewer-core), which it reads but can't change: it's every ship's, maintained by
 *      people, so a generation for one ship never changes another (policy.ts). After each file it writes, the ship's
 *      new type errors are sent back to it (every version of every section is in the ship's src/, so each is checked
 *      and keeps working with the shared components); when it wants to finish, anything still wrong (a missing entry
 *      file, new type errors in the ship) sends it back to fix it, a few times at most. The job then checks once more,
 *      so the ship's build keeps working: both entry files, and no new type errors in the ship. Otherwise everything
 *      fails.
 *   3b. The section's objects (picked in the Library): the agent looks at an object's image only the first time a
 *      generation uses it, and writes its card; later generations get the card as text instead (objects.ts). The
 *      code draws objects with the viewer's ObjectSymbol2D and ObjectModel3D, which show their files at runtime.
 *   4. The agent works on a copy of the ship (its stage, staging.ts), so the real one only changes once everything
 *      passed: the stage's changes are then applied (each path checked again; nothing at all if a real file changed
 *      meanwhile), and the new version is listed in section.json and becomes the one in use (`codegenVersion`, which
 *      names the folder the viewer loads), so restoreCodegenVersion can switch to any version. If it fails, is
 *      stopped, or reaches a limit (turns, fix rounds), the stage is discarded and nothing changes.
 *   4b. It runs on the Claude plan Claude Code is signed in with (plan.ts). While the plan's usage limit is reached,
 *      the generation waits for it to reset (status "queued", with `waitingUntil`), then starts: checked before it
 *      starts, and when the agent reaches the limit while working, its stage is discarded and it starts again, on a
 *      fresh copy, once the limit has reset. Generations after it wait too, since they run one at a time.
 *   5. However it ends, its status, tokens and turns are saved in section.json (`usage`) and added to the ship's
 *      codegen/usage.jsonl, one line per generation.
 * Jobs live in this server process: one that's queued or running when the server stops shows as interrupted, and its
 * stage is removed by the next generation.
 */

const SUMMARY_MAX = 4000;
const STATE_MAX = 100;
const ROLLBACK_DELAY_MS = 1000;
/** How often a generation waits for the plan's usage limit and starts again, at most; reaching it again fails it. */
const MAX_PLAN_WAITS = 6;
/** A generation starts again this long after the limit's reset, so the plan's usage has turned over. */
const RESET_MARGIN_MS = 60_000;

function jobKey(projectId: string, sectionId: string) {
  return `${projectId}/${sectionId}`;
}

function now() {
  return new Date().toISOString();
}

function cancel(job: Job, reason: string) {
  job.cancelReason ??= reason;
  job.controller.abort();
}

/**
 * Brings a section's job in line with its saved record, after a save: starts a job for a generation queued by this
 * server process, and stops a job whose generation was replaced or whose line diagram was removed.
 */
export function reconcileCodegen(projectId: string, record: { id: string } & Record<string, unknown>) {
  const key = jobKey(projectId, record.id);
  const codegen = readCodegen(record.codegen);
  const lineDiagram = (record.lineDiagram as { storedName?: unknown } | undefined)?.storedName;
  const current = codegen && isCodegenActive(codegen) && codegen.lineDiagram === lineDiagram ? codegen : undefined;
  const job = runtime.jobs.get(key);
  if (job && job.runId !== current?.runId) {
    cancel(job, lineDiagram ? "Replaced by a newer generation." : "The line diagram was removed.");
  }
  // A queued generation this process doesn't know is left from before a restart; it isn't restarted by a save.
  if (current?.status === "queued" && runtime.runs.has(current.runId) && runtime.jobs.get(key)?.runId !== current.runId) {
    startJob(projectId, record.id, current.runId);
  }
}

/** "Generate again": queues a new generation from the section's current line diagram, and starts it. */
export async function requestCodegen(projectId: string, sectionId: string) {
  const result = await patchSectionCodegen(projectId, sectionId, (_state, section) => {
    if (!section.lineDiagram) throw new ApiError(400, "Upload a line diagram first: the code is generated from it.");
    return { codegen: queueRun(section.lineDiagram.storedName) };
  });
  if (!result) throw new ApiError(404, `${sectionId} no longer exists.`);
  reconcileCodegen(projectId, result.record);
}

/** Stops a section's generation and waits until its files are rolled back. */
export async function cancelCodegen(projectId: string, sectionId: string) {
  if (await stopCodegen(projectId, sectionId, "Stopped.")) return;
  // Nothing runs it in this process (it was queued before a restart): just mark it as stopped.
  await patchSectionCodegen(projectId, sectionId, ({ codegen }) =>
    codegen && isCodegenActive(codegen)
      ? { codegen: { ...codegen, status: "cancelled", finishedAt: now(), error: "Stopped." } }
      : undefined,
  );
}

/** Settles once the job, and any it replaced that may still be rolling back, have finished. */
function finished(job: Job): Promise<void> {
  return Promise.all([job.done, job.replaced]).then(() => undefined);
}

/**
 * Stops a section's job, if it has one, and waits until it (and any job it replaced) has rolled back, so nothing
 * writes into the section's folder afterwards. Returns whether there was one.
 */
export async function stopCodegen(projectId: string, sectionId: string, reason: string): Promise<boolean> {
  const key = jobKey(projectId, sectionId);
  const job = runtime.jobs.get(key);
  if (!job) return false;
  cancel(job, reason);
  await finished(job);
  return true;
}

/** Stops every job of a ship (before it's deleted), and waits until they've rolled back. */
export async function stopShipCodegen(projectId: string, reason: string) {
  const jobs = [...runtime.jobs.values()].filter((job) => job.projectId === projectId);
  for (const job of jobs) cancel(job, reason);
  await Promise.all(jobs.map(finished));
}

function startJob(projectId: string, sectionId: string, runId: string) {
  const key = jobKey(projectId, sectionId);
  // A job this one replaces (already cancelled by reconcileCodegen) may still be rolling back.
  const earlier = runtime.jobs.get(key);
  const job: Job = {
    key,
    projectId,
    sectionId,
    runId,
    controller: new AbortController(),
    done: Promise.resolve(),
    replaced: earlier ? finished(earlier) : Promise.resolve(),
  };
  runtime.jobs.set(key, job);
  // Waits for the ship's earlier jobs, and for every earlier job of any ship, since jobs run one at a time.
  const previous = Promise.all([runtime.queues.get(projectId), runtime.jobChain]).then(() => undefined);
  job.done = runJob(job, previous)
    .catch((error) => console.error(`Code generation for ${key} failed unexpectedly:`, error))
    .finally(() => {
      if (runtime.jobs.get(key) === job) runtime.jobs.delete(key);
      runtime.runs.delete(runId);
    });
  // The next job of this ship waits for this one and every one before it (a stopped job can finish early).
  const tail: Promise<void> = Promise.all([previous, job.done]).then(() => {
    if (runtime.queues.get(projectId) === tail) runtime.queues.delete(projectId);
  });
  runtime.queues.set(projectId, tail);
  runtime.jobChain = Promise.all([runtime.jobChain, job.done]).then(() => undefined);
}

function whenAborted(signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) resolve();
    else signal.addEventListener("abort", () => resolve(), { once: true });
  });
}

function setProgress(job: Job, step: string) {
  const run = runtime.runs.get(job.runId);
  if (run) run.progress = step;
}

/**
 * Saves the job's status in section.json, unless the section has moved on to another generation (or is gone).
 * `update` gets the section's current generation and fields, and returns the new generation, plus any other fields.
 */
async function save(
  job: Job,
  update: (current: SectionCodegen, state: CodegenState) => SectionCodegen | (Partial<CodegenState> & { codegen: SectionCodegen }),
) {
  try {
    await patchSectionCodegen(job.projectId, job.sectionId, (state) => {
      if (state.codegen?.runId !== job.runId) return undefined;
      const next = update(state.codegen, state);
      const fields = "runId" in next ? { codegen: next } : next;
      // Progress is only shown live, never saved.
      return { ...fields, codegen: { ...fields.codegen, progress: undefined } };
    });
  } catch (error) {
    console.error(`Couldn't save the code generation status of ${job.key}:`, error);
  }
}

/** The section's generation target, if it's still this job's: not gone, nor replaced by a newer generation. */
async function currentTarget(job: Job): Promise<CodegenTarget | null> {
  const target = await findCodegenTarget(job.projectId, job.sectionId);
  const section = target?.section;
  if (!target || !section || section.codegen?.runId !== job.runId || section.lineDiagram?.storedName !== section.codegen.lineDiagram) {
    return null;
  }
  return target;
}

/**
 * While the Claude plan's usage limit is reached, the generation waits for it to reset (status "queued", with
 * `waitingUntil`), checking the plan again after each reset; then it returns whether it waited. Stopping the
 * generation ends the wait (it throws). With `hit`, the agent has just reached the limit: it waits for the reset
 * Claude Code gave, or what the plan's usage says, or a few minutes.
 */
async function waitForPlan(job: Job, hit?: PlanLimitError): Promise<boolean> {
  const { signal } = job.controller;
  let waited = false;
  let until = hit
    ? (hit.resetsAt ?? (await planLimitUntil(MODEL, { fresh: true })) ?? new Date(Date.now() + UNKNOWN_RESET_WAIT_MS))
    : await planLimitUntil(MODEL);
  // Just reached, so not "already reset", whatever the clocks say.
  if (hit && until) until = new Date(Math.max(until.getTime(), Date.now() + RESET_MARGIN_MS));
  try {
    while (until && until.getTime() > Date.now()) {
      const waitingUntil = until.toISOString();
      console.info(`Code generation for ${job.key}: the Claude plan's usage limit is reached; waiting until ${waitingUntil}.`);
      setPlanWait(waitingUntil);
      setProgress(job, "Waiting for the Claude plan's usage limit to reset");
      await save(job, (current) => ({ ...current, status: "queued", waitingUntil }));
      await sleepUntil(new Date(until.getTime() + RESET_MARGIN_MS), signal);
      waited = true;
      until = await planLimitUntil(MODEL, { fresh: true });
    }
  } finally {
    setPlanWait(undefined);
  }
  return waited;
}

async function runJob(job: Job, previous: Promise<void>) {
  const { signal } = job.controller;
  await Promise.race([previous, whenAborted(signal)]);
  if (signal.aborted) {
    const target = await findCodegenTarget(job.projectId, job.sectionId).catch(() => null);
    await end(job, target, { status: "cancelled", error: job.cancelReason });
    return;
  }

  // Gone, or replaced while it waited (the replacement has its own job).
  let target = await currentTarget(job);
  if (!target) return;

  const attempt: Attempt = {};
  let mode: CodegenMode | undefined;
  try {
    mode = await nextMode(target.shipDir);
    // The plan's limit is checked before the agent starts, and again whenever the agent reaches it. After a wait, the
    // section is read again (it may have changed meanwhile, or been replaced).
    let waited = await waitForPlan(job);
    for (let waits = 0; ; waits += 1) {
      if (waited) {
        target = await currentTarget(job);
        if (!target) return;
      }
      try {
        await generate(job, target, mode, attempt);
        return;
      } catch (error) {
        if (!(error instanceof PlanLimitError) || signal.aborted) throw error;
        if (waits >= MAX_PLAN_WAITS) {
          throw new Error(`The Claude plan's usage limit was reached ${waits + 1} times during this generation, so it was stopped. Use Generate again to retry.`);
        }
        console.info(`Code generation for ${job.key}: the agent reached the Claude plan's usage limit; it starts again after the reset.`);
        await waitForPlan(job, error);
        waited = true;
      }
    }
  } catch (error) {
    const limit = error instanceof AgentError ? error.limit : undefined;
    // Stopped by a check (a path changed under a tool call) is a failure; stopped on request is "cancelled".
    const failure = job.failure;
    const cancelled = signal.aborted && !failure;
    let message = failure ?? (cancelled ? (job.cancelReason ?? "Stopped.") : error instanceof Error ? error.message : String(error));
    if (!cancelled) console.warn(`Code generation for ${job.key} failed:`, error);
    if (attempt.undoFailed) message += " Some of the files it had applied couldn't be put back; the server log lists them.";
    await end(job, target, { status: cancelled ? "cancelled" : "failed", error: message, usage: attempt.usage, limit, mode });
  }
}

/** What the latest attempt at a generation did, for when the generation ends. */
interface Attempt {
  usage?: CodegenUsage;
  /** It failed after applying changes to the real ship, and some of them couldn't be undone. */
  undoFailed?: boolean;
}

/**
 * One attempt at a generation, on a fresh copy of the ship (its stage): the agent writes the code, which is checked,
 * applied to the real ship, and kept as the section's next version. If anything fails, what it applied is undone and
 * it throws; a PlanLimitError when the agent reached the Claude plan's usage limit.
 */
async function generate(job: Job, target: CodegenTarget, runMode: CodegenMode, attempt: Attempt) {
  const { signal } = job.controller;
  const { section } = target;
  const lineDiagram = section.lineDiagram;
  if (!lineDiagram) throw new Error("The section no longer has a line diagram.");

  let stage: Stage | undefined;
  let applied: AppliedStage | undefined;
  attempt.usage = undefined;
  try {
    await save(job, (current) => ({ ...current, status: "running", mode: runMode, startedAt: now(), waitingUntil: undefined }));

    // The agent works on a copy (staging.ts), so nothing real changes until its code has passed every check.
    setProgress(job, "Copying the ship to work on");
    await discardStaleStages();
    const workStage = await createStage(job.runId, target.shipDir, section.dir);
    stage = workStage;
    // The section's next version gets a folder of its own, beside the earlier ones, which stay as they are. The
    // section's versions only change in its own jobs, which run one at a time, so the number can't be taken.
    const version = await nextVersion(section);
    const folder = codegenVersionFolder(version);
    const output = path.join(workStage.section, folder);
    const policy = await CodegenPolicy.open({ ship: workStage.ship, section: workStage.section, output, stage: workStage.dir });
    const runJournal = new FileJournal(policy);
    // The code in use is where the new version starts from: copied into its folder for the agent to change.
    const base = await codeInUse(section);
    if (base) await copyCode(path.join(workStage.section, path.relative(section.dir, base.dir)), output, policy, runJournal);

    // The objects new to the ship's code are looked at (and get cards); the others are described by their cards.
    setProgress(job, "Looking up the section's objects");
    const objectPlan = await planObjects(target.objects, target.shipDir, workStage.ship);
    policy.allowObjects(objectAccess(objectPlan));

    // The ship's project, the only one the agent may change, checked against its errors from before the run (the
    // shared viewer's files are part of it, as the ship's build compiles them).
    setProgress(job, "Type-checking the project");
    const shipChecker = await TypeChecker.open(workStage.ship, { signal });
    signal.throwIfAborted();
    // The section's code must be right, or the generation fails.
    const ownProblems = () => findProblems(output, () => shipChecker.fresh());

    const values = await promptValues(target, workStage, policy, objectPlan, { version, output, base });
    const [system, prompt] = await Promise.all([renderPrompt("rules", values), renderPrompt(runMode, values)]);
    const drawing = await readImage(section.dir, lineDiagram.storedName);
    const outcome = await runAgent({
      system,
      prompt,
      images: [...(drawing ? [drawing] : []), ...objectImages(objectPlan)],
      policy,
      journal: runJournal,
      controller: job.controller,
      typecheck: () => shipChecker.report(),
      errorsAfterWrite: () => shipChecker.fresh(),
      readFirst: [...(await requiredReads(workStage.ship, CODEGEN_SHARED_DIR, policy.core)), ...objectReads(objectPlan, policy)],
      verify: async () => ({
        own: describeProblems(await ownProblems(), values.codeDir),
        cards: await checkCards(objectPlan, runJournal, policy),
      }),
      stop: (reason) => {
        job.failure ??= reason;
        job.controller.abort();
      },
      onProgress: (step) => setProgress(job, step),
      onUsage: (latest) => (attempt.usage = latest),
    });
    signal.throwIfAborted();

    setProgress(job, "Checking the generated code");
    const { missing, fresh } = await ownProblems();
    const afterFixes = outcome.fixRounds ? ` (after ${outcome.fixRounds} round(s) of fixes)` : "";
    if (missing.length) throw new Error(`The agent didn't create ${missing.join(" or ")}${afterFixes}.`);
    if (fresh.length) {
      throw new Error(`The generated code still has type errors${afterFixes}, so it was discarded:\n${formatDiagnostics(fresh.slice(0, 5))}`);
    }

    // The new objects' cards are kept if they're right (so later generations don't need the images), else left out.
    const objects = await settleCards(objectPlan, runJournal);
    if (objects.learned.length || objects.reused.length || objects.skipped.length) {
      console.info(
        `Code generation for ${job.key}: objects looked at ${objects.learned.join(", ") || "none"}; ` +
          `from cards ${objects.reused.join(", ") || "none"}; not looked at ${objects.skipped.join(", ") || "none"}.`,
      );
    }

    // Everything passed: the stage's changes go to the real ship, each path checked again as it's written, and none at
    // all if a real file changed meanwhile.
    signal.throwIfAborted();
    setProgress(job, "Applying the checked changes");
    const realOutput = path.join(section.dir, folder);
    const realPolicy = await CodegenPolicy.open({ ship: target.shipDir, section: section.dir, output: realOutput });
    applied = await applyStage(workStage, runJournal, realPolicy);
    const files = applied.files.map((file) => path.relative(target.shipDir, file).split(path.sep).join("/")).sort();

    const finishedAt = now();
    const entry: CodegenVersion = {
      version,
      finishedAt,
      mode: runMode,
      lineDiagramName: lineDiagram.name,
      files: await listGeneratedFiles(realOutput),
    };
    await recordGeneration(target.shipDir, { sectionId: section.id, section: section.name, version, mode: runMode, finishedAt, files });
    const summary = outcome.summary.trim().slice(0, SUMMARY_MAX);
    const { usage } = attempt;
    await save(job, (current, state) => ({
      codegen: { ...current, status: "done", finishedAt, files, summary, version, usage, objects, error: undefined, waitingUntil: undefined },
      versions: [...state.versions.filter((other) => other.version !== version), entry],
      activeVersion: version,
    }));
    await logUsage(target, job, { status: "done", mode: runMode, finishedAt, usage, objects });
  } catch (error) {
    try {
      await applied?.undo();
    } catch (undoError) {
      console.error(`Couldn't undo all the changes the code generation for ${job.key} had applied:`, undoError);
      attempt.undoFailed = true;
    }
    throw error;
  } finally {
    if (stage) {
      // The SDK reports a stop as soon as it's asked to, so let a write the agent had already started land first.
      if (signal.aborted) await new Promise((resolve) => setTimeout(resolve, ROLLBACK_DELAY_MS));
      await discardStage(stage).catch((error) => console.error(`Couldn't remove the working copy of ${job.key}:`, error));
    }
  }
}

/** Saves how a generation ended, when it didn't succeed, and adds it to the ship's usage log. */
async function end(
  job: Job,
  target: CodegenTarget | null,
  ending: { status: "failed" | "cancelled"; error?: string; usage?: CodegenUsage; limit?: CodegenLimit; mode?: CodegenMode },
) {
  const finishedAt = now();
  const { status, error, usage, limit } = ending;
  await save(job, (current) => ({ ...current, status, finishedAt, error, usage, limit, waitingUntil: undefined }));
  if (target) await logUsage(target, job, { ...ending, finishedAt });
}

/** One line of a ship's usage log (CODEGEN_USAGE_FILE). */
interface UsageEntry {
  runId: string;
  sectionId: string;
  section: string;
  status: "done" | "failed" | "cancelled";
  mode?: CodegenMode;
  limit?: CodegenLimit;
  requestedAt?: string;
  finishedAt: string;
  model?: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
  /** Unset when the generation was stopped before the SDK reported them. */
  turns?: number;
  /** How the section's objects were used: which images were sent, and which came from cards. Set when it's done. */
  objects?: CodegenObjects;
  error?: string;
}

/**
 * Adds a finished generation (done, failed or stopped) to the ship's usage log, so every generation's tokens and turns
 * are kept, not just the latest one's in section.json. Only one job runs at a time, so appends don't interleave.
 */
async function logUsage(
  target: CodegenTarget,
  job: Job,
  ending: {
    status: UsageEntry["status"];
    finishedAt: string;
    error?: string;
    usage?: CodegenUsage;
    limit?: CodegenLimit;
    mode?: CodegenMode;
    objects?: CodegenObjects;
  },
) {
  const { usage } = ending;
  const record: UsageEntry = {
    runId: job.runId,
    sectionId: job.sectionId,
    section: target.section.name,
    status: ending.status,
    mode: ending.mode,
    limit: ending.limit,
    requestedAt: target.section.codegen?.runId === job.runId ? target.section.codegen.requestedAt : undefined,
    finishedAt: ending.finishedAt,
    model: usage?.model,
    inputTokens: usage?.inputTokens ?? 0,
    outputTokens: usage?.outputTokens ?? 0,
    cacheCreationInputTokens: usage?.cacheCreationInputTokens ?? 0,
    cacheReadInputTokens: usage?.cacheReadInputTokens ?? 0,
    turns: usage?.turns,
    objects: ending.objects,
    error: ending.error?.slice(0, 500),
  };
  try {
    const file = path.join(target.shipDir, ...CODEGEN_USAGE_FILE.split("/"));
    await fs.mkdir(path.dirname(file), { recursive: true });
    await assertPlainPath(CHILD_DIR, file);
    await fs.appendFile(file, `${JSON.stringify(record)}\n`);
  } catch (error) {
    console.error(`Couldn't add the code generation of ${job.key} to the ship's usage log:`, error);
  }
}

async function isFile(file: string): Promise<boolean> {
  return fs.stat(file).then((stat) => stat.isFile(), () => false);
}

/** What's wrong with a section's generated code: its missing entry files, and the new type errors of the projects the run changed. */
interface Problems {
  missing: string[];
  fresh: Diagnostic[];
}

/** `codeDir` is the version folder the generation writes. */
async function findProblems(codeDir: string, freshErrors: () => Promise<Diagnostic[]>): Promise<Problems> {
  const missing: string[] = [];
  for (const name of [CODEGEN_ENTRY_2D, CODEGEN_ENTRY_3D]) {
    if (!(await isFile(path.join(codeDir, name)))) missing.push(name);
  }
  return { missing, fresh: await freshErrors() };
}

/** Problems as the agent is told them when it wants to finish, or null if there are none. `codeDir` as the agent sees it. */
function describeProblems({ missing, fresh }: Problems, codeDir: string): string | null {
  const parts: string[] = [];
  if (missing.length) {
    parts.push(`Missing: ${missing.map((name) => `\`${codeDir}/${name}\``).join(" and ")}. The viewer loads both entry files from this version's folder.`);
  }
  if (fresh.length) {
    parts.push(`${fresh.length} type error(s) in this ship's project that weren't there before you started:\n${diagnosticsBlock(fresh)}`);
  }
  return parts.length ? parts.join("\n\n") : null;
}

/**
 * The drawing as an image for the prompt, or undefined for an SVG, which the agent reads as text instead. Its path is
 * checked first: it's sent to Claude, so it mustn't be a link to some other file.
 */
async function readImage(sectionDir: string, storedName: string): Promise<AgentImage | undefined> {
  const mediaType = IMAGE_MEDIA_TYPES[getExtension(storedName)];
  if (!mediaType) return undefined;
  const file = path.join(sectionDir, storedName);
  await assertPlainPath(CHILD_DIR, file);
  return { caption: "The section's line diagram, to turn into code:", mediaType, data: (await fs.readFile(file)).toString("base64") };
}

/** Where a section's code in use is, if it has some (see codeInUse). */
interface CodeInUse {
  /** Absolute: its version's folder, or the section's folder itself. */
  dir: string;
  /** The version, unless it's in the section's folder itself. */
  version?: number;
}

/**
 * Where a section's code in use is, as the viewer finds it: the folder of its version in use (`codegenVersion`) if
 * that has the 2D entry file; otherwise the section's folder itself if it has one (code written by hand, or from
 * before version folders). Null if it has none.
 */
async function codeInUse(section: CodegenSection): Promise<CodeInUse | null> {
  if (section.activeVersion !== undefined) {
    const dir = path.join(section.dir, codegenVersionFolder(section.activeVersion));
    if (await isFile(path.join(dir, CODEGEN_ENTRY_2D))) return { dir, version: section.activeVersion };
  }
  return (await isFile(path.join(section.dir, CODEGEN_ENTRY_2D))) ? { dir: section.dir } : null;
}

/** The version folders in a section's folder, by version number. */
async function versionFolders(sectionDir: string): Promise<Map<number, string>> {
  const folders = new Map<number, string>();
  for (const entry of await fs.readdir(sectionDir, { withFileTypes: true }).catch(() => [])) {
    const version = entry.isDirectory() ? parseVersionFolder(entry.name.toLowerCase()) : undefined;
    if (version !== undefined) folders.set(version, path.join(sectionDir, entry.name));
  }
  return folders;
}

/**
 * The section's next version: after every version it lists, and every version folder in its folder (one left there
 * by hand, say), so a new version never lands in a folder that's already there.
 */
async function nextVersion(section: CodegenSection): Promise<number> {
  const onDisk = [...(await versionFolders(section.dir)).keys()];
  return Math.max(0, ...section.versions.map((entry) => entry.version), ...onDisk) + 1;
}

/**
 * Copies the code in use (in the stage) into the new version's folder, so the agent changes it there rather than
 * starting over. Written through the run's journal, so the copies are applied with the agent's own changes; the same
 * checks as the agent's writes.
 */
async function copyCode(from: string, to: string, policy: CodegenPolicy, journal: FileJournal) {
  for (const file of await listGeneratedFiles(from)) {
    const source = path.join(from, ...file.split("/"));
    await assertPlainPath(CHILD_DIR, source);
    const checked = await policy.checkWrite(path.join(to, ...file.split("/")));
    if ("refused" in checked) throw new Error(`The section's code in use can't be copied into its new version (${file}): ${checked.refused}`);
    await journal.remember(checked.target);
    await fs.mkdir(path.dirname(checked.target), { recursive: true });
    await assertPlainPath(CHILD_DIR, checked.target);
    await fs.copyFile(source, checked.target);
  }
}

/**
 * The version folders the project tree lists with a note instead of their files (absolute, in the stage): the
 * section's own earlier versions, and the other sections' versions that aren't in use. Other sections' code in use,
 * and the new version, are listed in full.
 */
async function collapsedVersions(target: CodegenTarget, stage: Stage, output: string): Promise<Map<string, string>> {
  const notes = new Map<string, string>();
  const newFolder = path.basename(output);
  for (const section of target.sections) {
    const own = section.id === target.section.id;
    const dir = path.join(stage.ship, path.relative(target.shipDir, section.dir));
    for (const [version, folder] of await versionFolders(dir)) {
      if (folder === output) continue;
      if (version !== section.activeVersion) notes.set(folder, "an earlier version, kept as it was: not in use");
      else if (own) notes.set(folder, `the version in use, copied into ${newFolder}/ for you to change`);
    }
  }
  return notes;
}

/** What promptValues needs to know about this generation's version. */
interface VersionContext {
  version: number;
  /** Its folder, in the stage. */
  output: string;
  /** The code in use it starts from (real paths), if any. */
  base: CodeInUse | null;
}

/**
 * The prompts' values. Text that came from people (names typed in the Library, file names) is quoted or fenced as data
 * (untrusted.ts), so it can't pass for instructions.
 */
async function promptValues(
  target: CodegenTarget,
  stage: Stage,
  policy: CodegenPolicy,
  objectPlan: ObjectPlan,
  { version, output, base }: VersionContext,
): Promise<PromptValues> {
  const { section, shipDir } = target;
  const folderOf = (dir: string) => path.relative(shipDir, dir).split(path.sep).join("/");
  const sectionDir = folderOf(section.dir);
  const codeDir = `${sectionDir}/${path.basename(output)}`;
  const imagePath = `${sectionDir}/${section.lineDiagram?.storedName}`;
  const generated: string[] = [];
  for (const other of target.sections) {
    const code = other.id === section.id ? null : await codeInUse(other);
    if (code) generated.push(`${quoteText(other.name)} (code in use: \`${folderOf(code.dir)}/\`)`);
  }
  let previousCode = "";
  if (base) {
    const where = `\`${folderOf(base.dir)}/\``;
    previousCode =
      `This section already has code, made from an earlier drawing: ${base.version ? `version ${base.version}, in ${where}` : `in ${where}`}. ` +
      `Its files have been copied into \`${codeDir}/\`, this version's folder: read them there first, then change them to match this ` +
      `drawing, keeping what still fits. Leave ${where} as it is.`;
  }
  return {
    shipName: quoteText(target.shipName),
    sectionName: quoteText(section.name),
    sectionId: /^[A-Z]+-\d+$/.test(section.id) ? section.id : quoteText(section.id),
    sectionDir,
    codeDir,
    version: String(version),
    drawing: IMAGE_MEDIA_TYPES[getExtension(imagePath)]
      ? `attached to this message (it's also saved as \`${imagePath}\`)`
      : `an SVG file, \`${imagePath}\`: read it with the Read tool`,
    generatedSections: generated.length ? generated.join(", ") : "none at the moment",
    previousCode,
    projectTree: dataBlock(await projectTree(stage.ship, await collapsedVersions(target, stage, output))),
    coreDir: policy.label(policy.core),
    coreTree: dataBlock(await projectTree(policy.core)),
    childDir: toLabel(policy.child),
    objects: objectsPrompt(objectPlan, policy),
  };
}

/** A finished generation, as listed in the ship's codegen/generations.json. */
interface Generation {
  sectionId: string;
  section: string;
  /** The section's version it created. */
  version: number;
  mode: CodegenMode;
  finishedAt: string;
  /** Every file it created or changed, relative to the ship's folder. */
  files: string[];
}

function stateFile(shipDir: string) {
  return path.join(shipDir, ...CODEGEN_STATE_FILE.split("/"));
}

async function readGenerations(shipDir: string): Promise<Generation[]> {
  const file = stateFile(shipDir);
  let text: string;
  try {
    text = await fs.readFile(file, "utf8");
  } catch (error) {
    if (errorCode(error) === "ENOENT") return [];
    throw error;
  }
  try {
    const { generations } = JSON.parse(text);
    if (!Array.isArray(generations)) throw new Error("it has no generations list");
    return generations;
  } catch (error) {
    // Guessing "first" could overwrite the ship's shared components, so the generation fails instead.
    throw new Error(`The ship's ${CODEGEN_STATE_FILE} can't be read (${error instanceof Error ? error.message : error}). Fix or delete it.`);
  }
}

/** The prompt for the ship's next generation: "first" until one has finished, then "second". */
async function nextMode(shipDir: string): Promise<CodegenMode> {
  return (await readGenerations(shipDir)).length ? "second" : "first";
}

/** Only one job per ship runs at a time, so this read-and-write can't race another. */
async function recordGeneration(shipDir: string, generation: Generation) {
  const generations = [...(await readGenerations(shipDir)), generation].slice(-STATE_MAX);
  const file = stateFile(shipDir);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await assertPlainPath(CHILD_DIR, file);
  await writeAtomic(file, `${JSON.stringify({ generations }, null, 2)}\n`);
}

/**
 * Switches a section's views to one of its versions. Nothing is copied: each version's code stays in its own folder
 * (src/sections/<folder>/v<N>/), and section.json's `codegenVersion` names the one the viewer loads. Every version is
 * in the ship's src/, so each generation's type check covers them all, and an earlier version keeps working with the
 * ship's current shared components. Refused while the section's code is being generated: that switches to the new
 * version when it's done.
 */
export async function restoreCodegenVersion(projectId: string, sectionId: string, version: number) {
  if (runtime.jobs.has(jobKey(projectId, sectionId))) {
    throw new ApiError(409, "This section's code is being generated. Try again once that's finished.");
  }
  const target = await findCodegenTarget(projectId, sectionId);
  if (!target) throw new ApiError(404, `${sectionId} no longer exists.`);
  const { section } = target;
  if (!section.versions.some((other) => other.version === version)) throw new ApiError(404, `${sectionId} has no version ${version}.`);
  if (section.activeVersion === version) return;
  const dir = path.join(section.dir, codegenVersionFolder(version));
  for (const name of [CODEGEN_ENTRY_2D, CODEGEN_ENTRY_3D]) {
    const file = path.join(dir, name);
    if ((await pathProblem(CHILD_DIR, file)) || !(await isFile(file))) {
      throw new ApiError(409, `Version ${version} can't be used: child/${toLabel(path.relative(CHILD_DIR, file))} is missing.`);
    }
  }
  await patchSectionCodegen(projectId, sectionId, ({ versions }) =>
    versions.some((other) => other.version === version) ? { activeVersion: version } : undefined,
  );
}
