import fs from "node:fs/promises";
import path from "node:path";
import {
  CODEGEN_ENTRY_2D,
  CODEGEN_ENTRY_3D,
  CODEGEN_SHARED_DIR,
  CODEGEN_STATE_FILE,
  CODEGEN_USAGE_FILE,
  codegenVersionDir,
  isCodegenActive,
  readCodegen,
} from "@/lib/codegen";
import { getExtension } from "@/lib/files";
import { CHILD_DIR, errorCode, writeAtomic } from "@/server/child-dir";
import { ApiError, findCodegenTarget, patchSectionCodegen, type CodegenState, type CodegenTarget } from "@/server/storage";
import type { CodegenLimit, CodegenMode, CodegenObjects, CodegenUsage, CodegenVersion, SectionCodegen } from "@/types/records";
import { AgentError, IMAGE_MEDIA_TYPES, MODEL, runAgent, type AgentImage } from "./agent";
import { checkCards, objectAccess, objectImages, objectReads, objectsPrompt, planObjects, settleCards, type ObjectPlan } from "./objects";
import { PlanLimitError, planLimitUntil, setPlanWait, sleepUntil, UNKNOWN_RESET_WAIT_MS } from "./plan";
import { assertPlainPath, CodegenPolicy, FileJournal, listGeneratedFiles, pathProblem, toLabel } from "./policy";
import { renderPrompt, type PromptValues } from "./prompts";
import { queueRun, runtime, type Job } from "./runtime";
import { applyStage, createStage, discardStage, discardStaleStages, removeTree, type AppliedStage, type Stage } from "./staging";
import { projectTree, requiredReads } from "./structure";
import { diagnosticsBlock, formatDiagnostics, newDiagnostics, typecheck, TypeChecker, type Diagnostic } from "./typecheck";
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
 *   3. The agent writes the code into the ship's project: the section's Diagram2D.tsx and Diagram3D.tsx, and shared
 *      components in src/shared/schematic/. It builds on the shared viewer (@shipdocs/viewer-core), which it reads but
 *      can't change: it's every ship's, maintained by people, so a generation for one ship never changes another
 *      (policy.ts). After each file it writes, the ship's new type errors are sent back to it; when it wants to
 *      finish, anything still wrong (a missing entry file, new type errors in the ship) sends it back to fix it, a few
 *      times at most. The job then checks once more, so the ship's build keeps working: both entry files, and no new
 *      type errors in the ship. Otherwise everything fails.
 *   3b. The section's objects (picked in the Library): the agent looks at an object's image only the first time a
 *      generation uses it, and writes its card; later generations get the card as text instead (objects.ts). The
 *      code draws objects with the viewer's ObjectSymbol2D and ObjectModel3D, which show their files at runtime.
 *   4. The agent works on a copy of the ship (its stage, staging.ts), so the real one only changes once everything
 *      passed: the stage's changes are then applied (each path checked again; nothing at all if a real file changed
 *      meanwhile), and the section's generated files become its next version (v1, v2…): copied to
 *      codegen/<section ID>/v<N>/ and listed in section.json, so restoreCodegenVersion can switch back to it. If it
 *      fails, is stopped, or reaches a limit (turns, fix rounds), the stage is discarded and nothing changes.
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
  // A restore takes seconds and can't be stopped halfway, so it's waited for.
  await runtime.restores.get(key);
  const job = runtime.jobs.get(key);
  if (!job) return false;
  cancel(job, reason);
  await finished(job);
  return true;
}

/** Stops every job of a ship (before it's deleted), and waits until they've rolled back and its restores are done. */
export async function stopShipCodegen(projectId: string, reason: string) {
  const jobs = [...runtime.jobs.values()].filter((job) => job.projectId === projectId);
  for (const job of jobs) cancel(job, reason);
  const restores = [...runtime.restores].filter(([key]) => key.startsWith(`${projectId}/`)).map(([, done]) => done);
  await Promise.all([...jobs.map(finished), ...restores]);
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
  // Waits for the ship's earlier jobs and restores, and for every earlier job of any ship, since jobs run one at a time.
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
    const policy = await CodegenPolicy.open({ ship: workStage.ship, section: workStage.section, stage: workStage.dir });
    const runJournal = new FileJournal(policy);

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
    const ownProblems = () => findProblems(workStage.section, () => shipChecker.fresh());

    const values = await promptValues(target, workStage, policy, objectPlan);
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
        own: describeProblems(await ownProblems(), values.sectionDir),
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
    const realPolicy = await CodegenPolicy.open({ ship: target.shipDir, section: section.dir });
    applied = await applyStage(workStage, runJournal, realPolicy);
    const files = applied.files.map((file) => path.relative(target.shipDir, file).split(path.sep).join("/")).sort();

    const finishedAt = now();
    // The section's versions only change in its own jobs, which run one at a time, so the number can't be taken.
    const version = Math.max(0, ...section.versions.map((entry) => entry.version)) + 1;
    const entry: CodegenVersion = {
      version,
      finishedAt,
      mode: runMode,
      lineDiagramName: lineDiagram.name,
      files: await keepVersion(target.shipDir, section.id, section.dir, version),
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

async function findProblems(sectionDir: string, freshErrors: () => Promise<Diagnostic[]>): Promise<Problems> {
  const missing: string[] = [];
  for (const name of [CODEGEN_ENTRY_2D, CODEGEN_ENTRY_3D]) {
    if (!(await isFile(path.join(sectionDir, name)))) missing.push(name);
  }
  return { missing, fresh: await freshErrors() };
}

/** Problems as the agent is told them when it wants to finish, or null if there are none. */
function describeProblems({ missing, fresh }: Problems, sectionDir: string): string | null {
  const parts: string[] = [];
  if (missing.length) {
    parts.push(`Missing: ${missing.map((name) => `\`${sectionDir}/${name}\``).join(" and ")}. The viewer loads both entry files.`);
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

/**
 * The prompts' values. Text that came from people (names typed in the Library, file names) is quoted or fenced as data
 * (untrusted.ts), so it can't pass for instructions.
 */
async function promptValues(target: CodegenTarget, stage: Stage, policy: CodegenPolicy, objectPlan: ObjectPlan): Promise<PromptValues> {
  const { section, shipDir } = target;
  const folderOf = (dir: string) => path.relative(shipDir, dir).split(path.sep).join("/");
  const sectionDir = folderOf(section.dir);
  const imagePath = `${sectionDir}/${section.lineDiagram?.storedName}`;
  const generated: string[] = [];
  for (const other of target.sections) {
    if (other.id !== section.id && (await isFile(path.join(other.dir, CODEGEN_ENTRY_2D)))) {
      generated.push(`${quoteText(other.name)} (\`${folderOf(other.dir)}/\`)`);
    }
  }
  return {
    shipName: quoteText(target.shipName),
    sectionName: quoteText(section.name),
    sectionId: /^[A-Z]+-\d+$/.test(section.id) ? section.id : quoteText(section.id),
    sectionDir,
    drawing: IMAGE_MEDIA_TYPES[getExtension(imagePath)]
      ? `attached to this message (it's also saved as \`${imagePath}\`)`
      : `an SVG file, \`${imagePath}\`: read it with the Read tool`,
    generatedSections: generated.length ? generated.join(", ") : "none at the moment",
    previousCode: (await isFile(path.join(section.dir, CODEGEN_ENTRY_2D)))
      ? "This section already has generated code, made from an earlier drawing: read it first, then change it to match this one, keeping what still fits."
      : "",
    projectTree: dataBlock(await projectTree(stage.ship)),
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

function versionDir(shipDir: string, sectionId: string, version: number) {
  return path.join(shipDir, ...codegenVersionDir(sectionId, version).split("/"));
}

/**
 * Copies the section's generated files to codegen/<section ID>/v<version>/, replacing anything left there (e.g. by a
 * generation that failed after copying). Returns the files, relative to the section's folder. Every source and
 * destination path is checked first.
 */
async function keepVersion(shipDir: string, sectionId: string, sectionDir: string, version: number): Promise<string[]> {
  const dir = versionDir(shipDir, sectionId, version);
  const files = await listGeneratedFiles(sectionDir);
  await assertPlainPath(CHILD_DIR, dir);
  await removeTree(dir);
  for (const file of files) {
    const source = path.join(sectionDir, ...file.split("/"));
    const target = path.join(dir, ...file.split("/"));
    await assertPlainPath(CHILD_DIR, source);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await assertPlainPath(CHILD_DIR, target);
    await fs.copyFile(source, target);
  }
  return files;
}

/**
 * Switches a section's code to one of its versions: its generated files are replaced by that version's, and the
 * ship must still type-check, or everything is put back and an ApiError (409) says why. Only the section's own files
 * change: the shared components stay as they are, since the ship's other sections use them. Hand edits to the
 * section's generated files are replaced too. Refused while the ship's code is being generated or restored.
 */
export async function restoreCodegenVersion(projectId: string, sectionId: string, version: number) {
  const key = jobKey(projectId, sectionId);
  if (runtime.queues.has(projectId)) {
    throw new ApiError(409, "This ship's code is being generated or restored. Try again once that's finished.");
  }
  const work = restoreVersion(projectId, sectionId, version);
  // Takes the ship's turn, so a generation started meanwhile waits until the files are in place.
  const settled = work.then(
    () => undefined,
    () => undefined,
  );
  runtime.restores.set(key, settled);
  const tail: Promise<void> = settled.then(() => {
    if (runtime.queues.get(projectId) === tail) runtime.queues.delete(projectId);
    if (runtime.restores.get(key) === settled) runtime.restores.delete(key);
  });
  runtime.queues.set(projectId, tail);
  return work;
}

async function restoreVersion(projectId: string, sectionId: string, version: number) {
  const target = await findCodegenTarget(projectId, sectionId);
  if (!target) throw new ApiError(404, `${sectionId} no longer exists.`);
  const { section, shipDir } = target;
  const entry = section.versions.find((other) => other.version === version);
  if (!entry) throw new ApiError(404, `${sectionId} has no version ${version}.`);
  if (section.activeVersion === version) return;
  const dir = versionDir(shipDir, sectionId, version);
  for (const file of entry.files) {
    if (!(await isFile(path.join(dir, ...file.split("/"))))) {
      throw new ApiError(409, `Version ${version}'s files are missing from child/ships/${path.basename(shipDir)}/${codegenVersionDir(sectionId, version)}/.`);
    }
  }

  const policy = await CodegenPolicy.open({ ship: shipDir, section: section.dir });
  const journal = new FileJournal(policy);
  const baseline = await typecheck(shipDir);
  try {
    for (const file of await listGeneratedFiles(section.dir)) {
      const checked = await policy.checkWrite(path.join(section.dir, ...file.split("/")));
      if ("target" in checked) await journal.remove(checked.target);
    }
    for (const file of entry.files) {
      // The same rules as the agent's writes, in case the kept files were changed by hand, for where they go and
      // where they come from.
      const checked = await policy.checkWrite(path.join(section.dir, ...file.split("/")));
      if ("refused" in checked) throw new ApiError(409, `Version ${version} has a file that can't be restored (${file}): ${checked.refused}`);
      const source = path.join(dir, ...file.split("/"));
      const sourceProblem = await pathProblem(CHILD_DIR, source);
      if (sourceProblem) throw new ApiError(409, `Version ${version} has a file that can't be restored (${file}): ${sourceProblem}`);
      await journal.remember(checked.target);
      await fs.mkdir(path.dirname(checked.target), { recursive: true });
      await assertPlainPath(CHILD_DIR, checked.target);
      await writeAtomic(checked.target, await fs.readFile(source));
    }
    const fresh = newDiagnostics(baseline, await typecheck(shipDir));
    if (fresh.length) {
      throw new ApiError(
        409,
        `Version ${version} doesn't type-check with the ship's current shared components, so it wasn't restored:\n${formatDiagnostics(fresh.slice(0, 5))}`,
      );
    }
  } catch (error) {
    await journal.restore();
    throw error;
  }
  await patchSectionCodegen(projectId, sectionId, () => ({ activeVersion: version }));
}
